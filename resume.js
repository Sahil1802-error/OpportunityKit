/**
 * resume.js - In-memory text extraction and deterministic entity suggestion for resumes (PDF & DOCX).
 * 
 * Complies with Section 1A.2, 12:
 * - Operates entirely in memory (zero disk retention).
 * - Extracts text from PDF (decompresses FlateDecode streams via node:zlib) and DOCX (extracts word/document.xml).
 * - Identifies skills via alias normalizer & curated skills dictionary.
 * - Extracts education, CGPA, graduation/year, URLs (GitHub, LinkedIn, Portfolio).
 * - Returns fields strictly as suggestions for user confirmation without overwriting confirmed data.
 */

const zlib = require('node:zlib');

let pdfParseLib = null;
try {
  const p = require('pdf-parse');
  pdfParseLib = p.PDFParse || p;
} catch (_) {}

let filterEssentialOpportunityText;
try {
  filterEssentialOpportunityText = require('./public/extract.js').filterEssentialOpportunityText;
} catch (_) {
  filterEssentialOpportunityText = require('./extract.js').filterEssentialOpportunityText;
}

/**
 * Validates whether a decoded string contains printable human language text
 * rather than unmapped glyph codes or binary bytecode.
 * @param {string} str
 * @returns {boolean}
 */
function isPredominantlyHumanText(str) {
  if (!str || str.length === 0) return false;
  let printable = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) {
      printable++;
    }
  }
  return (printable / str.length) >= 0.7;
}

/**
 * Sanitizes extracted text into clean, human-readable plain language:
 * - Strips PDF pagination headers/footers (e.g. '-- 1 of 5 --')
 * - Strips non-printable control characters
 * - Normalizes horizontal spacing and excessive blank lines
 * @param {string} text
 * @returns {string}
 */
function sanitizeHumanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Curated skills dictionary for deterministic matching
const KNOWN_SKILLS_DICTIONARY = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C", "C#", "Go", "Rust", "Ruby", "PHP",
  "HTML", "CSS", "React", "Next.js", "Angular", "Vue", "Node.js", "Express", "Django", "Flask",
  "FastAPI", "Spring Boot", "SQL", "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis",
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GitHub", "Linux", "Figma",
  "GraphQL", "REST API", "Tailwind CSS", "Bootstrap", "Machine Learning", "Data Structures"
];

// Skill alias map for normalization
const SKILL_ALIASES = {
  "js": "JavaScript",
  "javascript": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "py": "Python",
  "python": "Python",
  "html": "HTML",
  "html5": "HTML",
  "css": "CSS",
  "css3": "CSS",
  "react": "React",
  "reactjs": "React",
  "react.js": "React",
  "node": "Node.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "golang": "Go",
  "cpp": "C++",
  "cplusplus": "C++",
  "csharp": "C#"
};

/**
 * Parses CMap data (beginbfchar / beginbfrange) to map glyph IDs to Unicode characters.
 * @param {string} cmapText
 * @param {Map<string, string>} map
 */
function parseCMapData(cmapText, map) {
  if (!cmapText) return;

  // 1. Parse beginbfchar blocks: <srcHex> <dstHex>
  const bfcharRegex = /beginbfchar[\s\S]*?endbfchar/gi;
  let match;
  while ((match = bfcharRegex.exec(cmapText)) !== null) {
    const lines = match[0].match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g);
    if (lines) {
      lines.forEach(pair => {
        const pMatch = pair.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/);
        if (pMatch) {
          const src = pMatch[1].toLowerCase();
          const dstHex = pMatch[2];
          let str = '';
          for (let i = 0; i < dstHex.length; i += 4) {
            const code = parseInt(dstHex.substring(i, i + 4), 16);
            if (!isNaN(code)) str += String.fromCharCode(code);
          }
          map.set(src, str);
        }
      });
    }
  }

  // 2. Parse beginbfrange blocks
  const bfrangeRegex = /beginbfrange[\s\S]*?endbfrange/gi;
  while ((match = bfrangeRegex.exec(cmapText)) !== null) {
    const rangeLines = match[0].split('\n');
    rangeLines.forEach(line => {
      // Form A: <srcStart> <srcEnd> <dstStart>
      const directMatch = line.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/);
      if (directMatch) {
        const start = parseInt(directMatch[1], 16);
        const end = parseInt(directMatch[2], 16);
        let dst = parseInt(directMatch[3], 16);
        const hexLen = directMatch[1].length;
        for (let code = start; code <= end; code++) {
          const key = code.toString(16).padStart(hexLen, '0').toLowerCase();
          map.set(key, String.fromCharCode(dst));
          dst++;
        }
      }
      // Form B: <srcStart> <srcEnd> [ <dst1> <dst2> ... ]
      const arrayMatch = line.match(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]/);
      if (arrayMatch) {
        const start = parseInt(arrayMatch[1], 16);
        const end = parseInt(arrayMatch[2], 16);
        const items = arrayMatch[3].match(/<([0-9a-fA-F]+)>/g) || [];
        const hexLen = arrayMatch[1].length;
        items.forEach((itemHex, idx) => {
          const code = start + idx;
          if (code <= end) {
            const key = code.toString(16).padStart(hexLen, '0').toLowerCase();
            const cleanHex = itemHex.slice(1, -1);
            let str = '';
            for (let i = 0; i < cleanHex.length; i += 4) {
              const uCode = parseInt(cleanHex.substring(i, i + 4), 16);
              if (!isNaN(uCode)) str += String.fromCharCode(uCode);
            }
            map.set(key, str);
          }
        });
      }
    });
  }
}

/**
 * Asynchronously extracts clean, readable human plain language from a PDF buffer.
 * Uses Mozilla PDF.js via pdf-parse as primary high-fidelity engine,
 * with graceful fallback to deterministic stream extraction.
 * Guarantees zero disk writes and zero binary/font/PostScript leakage.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractTextFromPdfAsync(buffer) {
  if (!buffer || buffer.length === 0) return '';

  // 1. Primary Engine: PDFParse (Mozilla PDF.js)
  if (pdfParseLib) {
    try {
      const parser = new pdfParseLib(new Uint8Array(buffer));
      const res = await parser.getText();
      if (typeof parser.destroy === 'function') {
        try { await parser.destroy(); } catch (_) {}
      }

      let text = '';
      if (res && res.pages && Array.isArray(res.pages) && res.pages.length > 0) {
        text = res.pages.map(p => (p && p.text) ? p.text : '').join('\n\n');
      } else if (res && typeof res.text === 'string') {
        text = res.text;
      }

      const clean = sanitizeHumanText(text);
      if (clean.length > 0 && isPredominantlyHumanText(clean)) {
        return clean;
      }
    } catch (e) {
      // Gracefully fall back to deterministic parser below
    }
  }

  // 2. Synchronous stream extraction fallback
  return extractTextFromPdfSync(buffer);
}

/**
 * Extracts plain text from an in-memory PDF Buffer synchronously.
 * Accurately handles multi-stream offsets, FlateDecode decompression,
 * ToUnicode CMaps, hex strings (ASCII and UTF-16BE), TJ arrays with kerning,
 * and completely excludes font tables, XObjects, and PostScript metadata.
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractTextFromPdfSync(buffer) {
  const STREAM_MARKER = Buffer.from('stream');
  const ENDSTREAM_MARKER = Buffer.from('endstream');
  const rawStreams = [];
  const cMap = new Map();
  let pos = 0;

  // Pass 1: Discover all streams and extract decompressed buffers
  while (pos < buffer.length - 10) {
    const streamIdx = buffer.indexOf(STREAM_MARKER, pos);
    if (streamIdx === -1) break;

    // Look back for stream dictionary
    const dictStart = Math.max(0, streamIdx - 800);
    const dictHeader = buffer.subarray(dictStart, streamIdx).toString('latin1');
    const isFlate = dictHeader.includes('/FlateDecode') || dictHeader.includes('/Fl');

    // Skip font files, embedded font binaries, images, XRef, ObjStm, and metadata
    const isNonContent = dictHeader.includes('/FontFile') ||
                          dictHeader.includes('/FontFile2') ||
                          dictHeader.includes('/FontFile3') ||
                          dictHeader.includes('/Subtype /Image') ||
                          dictHeader.includes('/Subtype/Image') ||
                          dictHeader.includes('/Type /FontDescriptor') ||
                          dictHeader.includes('/Type/FontDescriptor') ||
                          dictHeader.includes('/Type /XRef') ||
                          dictHeader.includes('/Type /ObjStm') ||
                          dictHeader.includes('/Type /Metadata') ||
                          dictHeader.includes('/ICCBased') ||
                          dictHeader.includes('/DCTDecode') ||
                          dictHeader.includes('/JBIG2Decode') ||
                          dictHeader.includes('/JPXDecode');

    const isCMap = dictHeader.includes('/ToUnicode') || dictHeader.includes('/CMap') || dictHeader.includes('/CIDInit');

    let dataStart = streamIdx + 6;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endstreamIdx = buffer.indexOf(ENDSTREAM_MARKER, dataStart);
    if (endstreamIdx === -1) {
      pos = dataStart + 1;
      continue;
    }

    let dataEnd = endstreamIdx;
    while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d || buffer[dataEnd - 1] === 0x20)) {
      dataEnd--;
    }

    const rawChunk = buffer.subarray(dataStart, dataEnd);
    pos = endstreamIdx + 9;

    // If stream is an embedded font file or image and NOT a CMap, skip it
    if (isNonContent && !isCMap) {
      continue;
    }

    let decompressed = null;
    if (isFlate) {
      try {
        decompressed = zlib.inflateSync(rawChunk);
      } catch (e1) {
        try {
          decompressed = zlib.inflateRawSync(rawChunk);
        } catch (e2) {
          try {
            decompressed = zlib.unzipSync(rawChunk);
          } catch (e3) {}
        }
      }
    } else {
      decompressed = rawChunk;
    }

    if (decompressed && decompressed.length > 0) {
      const streamText = decompressed.toString('latin1');
      if (streamText.includes('beginbfchar') || streamText.includes('beginbfrange')) {
        parseCMapData(streamText, cMap);
      } else if (!isNonContent) {
        rawStreams.push(decompressed);
      }
    }
  }

  // Pass 2: Extract text strictly from content streams
  const chunks = [];
  rawStreams.forEach(streamBuf => {
    const text = parsePdfStreamText(streamBuf, cMap);
    if (text && text.trim().length > 0) {
      chunks.push(text.trim());
    }
  });

  // Fallback: If compressed streams produced little text, check uncompressed BT...ET in buffer
  if (chunks.join(' ').trim().length < 20) {
    const fullText = buffer.toString('latin1');
    const btMatches = fullText.match(/BT[\s\S]*?ET/g);
    if (btMatches) {
      btMatches.forEach(block => {
        const parsed = parsePdfStreamText(Buffer.from(block, 'latin1'), cMap);
        if (parsed && parsed.trim().length > 0) {
          chunks.push(parsed.trim());
        }
      });
    }
  }

  return sanitizeHumanText(chunks.join('\n\n'));
}

/**
 * Synchronous backward-compatible wrapper for extractTextFromPdfSync.
 */
function extractTextFromPdf(buffer) {
  return extractTextFromPdfSync(buffer);
}

/**
 * Parses text rendering operations strictly inside BT...ET text objects from a content stream.
 * Rejects any non-BT binary bytes to prevent encrypted codes or PostScript bytecode leakage.
 * @param {Buffer} streamBuf
 * @param {Map<string, string>} [cMap]
 * @returns {string}
 */
function parsePdfStreamText(streamBuf, cMap = new Map()) {
  const text = streamBuf.toString('latin1');
  const lines = [];

  // Extract all BT ... ET text blocks. Never process raw streams without BT...ET.
  const btBlocks = text.match(/BT[\s\S]*?ET/g);
  if (!btBlocks || btBlocks.length === 0) {
    return '';
  }

  btBlocks.forEach(block => {
    const blockTokens = [];
    // Tokenize text-showing operators and positioning operators:
    // 1. Literal string: (text) Tj / ' / " (handles escaped parens \( and \))
    // 2. Hex string: <hex> Tj / ' / "
    // 3. Array: [ ... ] TJ
    // 4. Position: Td, TD, T*, Tm
    const opRegex = /(?:\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")|\[([\s\S]*?)\]\s*TJ|(?:(?:[-+]?[0-9]*\.?[0-9]+\s+)+)?(?:Td|TD|T\*|Tm))/g;
    let m;

    while ((m = opRegex.exec(block)) !== null) {
      const matchStr = m[0];

      // 1. Literal string Tj
      if (m[1] !== undefined) {
        const clean = cleanPdfString(m[1]);
        if (clean.length > 0 && isPredominantlyHumanText(clean)) {
          blockTokens.push(clean);
        }
      }
      // 2. Hex string Tj
      else if (m[2] !== undefined) {
        const decoded = decodeHexWithCMap(m[2], cMap);
        if (decoded.length > 0 && isPredominantlyHumanText(decoded)) {
          blockTokens.push(decoded);
        }
      }
      // 3. TJ Array
      else if (m[3] !== undefined) {
        const tjInner = m[3];
        const tjTokenRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]+)>|([-+]?[0-9]+(?:\.[0-9]+)?)/g;
        let tjMatch;
        let tjStr = '';

        while ((tjMatch = tjTokenRegex.exec(tjInner)) !== null) {
          if (tjMatch[1] !== undefined) {
            tjStr += cleanPdfString(tjMatch[1]);
          } else if (tjMatch[2] !== undefined) {
            tjStr += decodeHexWithCMap(tjMatch[2], cMap);
          } else if (tjMatch[3] !== undefined) {
            const spacing = parseFloat(tjMatch[3]);
            // Negative spacing in PDF TJ indicates a space between characters/words
            if (spacing < -110 && tjStr.length > 0 && !tjStr.endsWith(' ')) {
              tjStr += ' ';
            }
          }
        }

        if (tjStr.trim().length > 0 && isPredominantlyHumanText(tjStr)) {
          blockTokens.push(tjStr.trim());
        }
      }
      // 4. Line break operator
      else if (/Td|TD|T\*|Tm$/.test(matchStr)) {
        if (blockTokens.length > 0 && blockTokens[blockTokens.length - 1] !== '\n') {
          blockTokens.push('\n');
        }
      }
    }

    if (blockTokens.length > 0) {
      const blockText = blockTokens.join(' ').replace(/[ \t]*\n[ \t]*/g, '\n').trim();
      if (blockText.length > 0) {
        lines.push(blockText);
      }
    }
  });

  return lines.join('\n');
}

/**
 * Decodes hex strings using CMap mappings when available, UTF-16BE, or ASCII.
 * @param {string} hex
 * @param {Map<string, string>} [cMap]
 * @returns {string}
 */
function decodeHexWithCMap(hex, cMap = new Map()) {
  const clean = hex.replace(/\s+/g, '');
  if (!clean || clean.length < 2) return '';

  // Check CMap mapping if available
  if (cMap && cMap.size > 0) {
    let result = '';
    let i = 0;
    while (i < clean.length) {
      // Try 4-char hex key first
      if (i + 4 <= clean.length) {
        const key4 = clean.substring(i, i + 4).toLowerCase();
        if (cMap.has(key4)) {
          result += cMap.get(key4);
          i += 4;
          continue;
        }
      }
      // Try 2-char hex key
      const key2 = clean.substring(i, i + 2).toLowerCase();
      if (cMap.has(key2)) {
        result += cMap.get(key2);
        i += 2;
        continue;
      }

      // Fallback: UTF-16BE code
      if (i + 4 <= clean.length) {
        const code = parseInt(clean.substring(i, i + 4), 16);
        if (code >= 32 && code <= 126) result += String.fromCharCode(code);
        else if (code === 10 || code === 13) result += '\n';
        i += 4;
      } else {
        const code = parseInt(clean.substring(i, i + 2), 16);
        if (code >= 32 && code <= 126) result += String.fromCharCode(code);
        i += 2;
      }
    }
    if (result.trim().length > 0) return result;
  }

  const buf = Buffer.from(clean, 'hex');
  // Check if UTF-16BE (starts with 00)
  if (buf.length >= 2 && buf[0] === 0) {
    let s = '';
    for (let i = 0; i < buf.length; i += 2) {
      const code = buf.readUInt16BE(i);
      if ((code >= 32 && code <= 126) || code === 10 || code === 13) s += String.fromCharCode(code);
    }
    return s;
  }

  // Latin1 ASCII
  return buf.toString('latin1').replace(/[^\x20-\x7E\r\n\t]/g, ' ');
}

/**
 * Cleans PDF escape characters.
 */
function cleanPdfString(str) {
  return str
    .replace(/\\([0-7]{1,3})/g, (match, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(.)/g, '$1');
}

/**
 * Extracts plain text from an in-memory DOCX (ZIP archive containing word/document.xml).
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractTextFromDocx(buffer) {
  let offset = 0;
  let documentXml = null;

  while (offset < buffer.length - 30) {
    if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const fileName = buffer.toString('utf-8', offset + 30, offset + 30 + fileNameLength);
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

      if (fileName === 'word/document.xml') {
        const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
        if (compressionMethod === 8) {
          try {
            documentXml = zlib.inflateRawSync(compressedData).toString('utf-8');
          } catch (e) {
            documentXml = zlib.inflateSync(compressedData).toString('utf-8');
          }
        } else if (compressionMethod === 0) {
          documentXml = compressedData.toString('utf-8');
        }
        break;
      }

      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }

  if (!documentXml) {
    return "";
  }

  // Extract by paragraph <w:p> to preserve distinct requirement lines
  const pMatches = documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
  if (pMatches && pMatches.length > 0) {
    const paragraphs = pMatches.map(p => {
      const textMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      return textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');
    }).filter(t => t.trim().length > 0);
    return paragraphs.join('\n').trim();
  }

  const textMatches = documentXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  const text = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Deterministically analyzes text to suggest profile fields.
 * @param {string} text
 * @returns {object} Suggestions object
 */
function suggestProfileFromText(text) {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: "No readable text found in document. File may be an image-only scan."
    };
  }

  const suggestions = {
    name: null,
    degree: null,
    branch: null,
    year: null,
    cgpa: null,
    skills: [],
    docs: { resume: true },
    links: {
      portfolio: "",
      github: "",
      linkedin: ""
    }
  };

  // 1. Skills detection (match against dictionary and aliases)
  const foundSkills = new Set();
  // Normalize delimiters (bullets, dashes, slashes, colons, pipes, commas) to spaces
  const cleanDelimitedText = ` ${text.replace(/[•\-\/\:\|\,\;\(\)\[\]\{\}\<\>\"\']/g, ' ').toLowerCase().replace(/\s+/g, ' ')} `;

  KNOWN_SKILLS_DICTIONARY.forEach(skill => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=\\s)${escaped}(?=[\\s.,])`, 'i');
    if (regex.test(cleanDelimitedText)) {
      foundSkills.add(skill);
    }
  });

  // Check aliases (e.g. JS -> JavaScript)
  Object.keys(SKILL_ALIASES).forEach(alias => {
    const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=\\s)${escaped}(?=[\\s.,])`, 'i');
    if (regex.test(cleanDelimitedText)) {
      foundSkills.add(SKILL_ALIASES[alias]);
    }
  });

  suggestions.skills = Array.from(foundSkills);

  // 2. CGPA / SGPA detection
  const cgpaMatch = text.match(/(?:CGPA|SGPA|GPA|Score|Grade|Aggregate)\s*[:=\-]?\s*([0-9](\.[0-9]{1,2})?)\s*(?:\/\s*(?:10|4))?/i) ||
                    text.match(/\b([0-9]\.[0-9]{1,2})\s*(?:CGPA|SGPA|GPA)\b/i) ||
                    text.match(/\b([0-9]\.[0-9]{1,2})\s*\/\s*10\b/i);
  if (cgpaMatch) {
    const val = parseFloat(cgpaMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      suggestions.cgpa = val;
    }
  }

  // 3. Degree detection
  if (/\b(B\.?Tech|Bachelor of Technology)\b/i.test(text)) {
    suggestions.degree = "B.Tech";
  } else if (/\b(B\.?E\.?|Bachelor of Engineering)\b/i.test(text)) {
    suggestions.degree = "B.E.";
  } else if (/\b(B\.?C\.?A\.?|Bachelor of Computer Applications)\b/i.test(text)) {
    suggestions.degree = "BCA";
  } else if (/\b(M\.?Tech|Master of Technology)\b/i.test(text)) {
    suggestions.degree = "M.Tech";
  } else if (/\b(M\.?C\.?A\.?|Master of Computer Applications)\b/i.test(text)) {
    suggestions.degree = "MCA";
  } else if (/\b(B\.?Sc|Bachelor of Science)\b/i.test(text)) {
    suggestions.degree = "B.Sc";
  }

  // 4. Branch detection
  if (/\b(Computer Science|CSE|CS|Software Engineering)\b/i.test(text)) {
    suggestions.branch = "CSE";
  } else if (/\b(Information Technology|IT)\b/i.test(text)) {
    suggestions.branch = "IT";
  } else if (/\b(Electronics and Communication|ECE)\b/i.test(text)) {
    suggestions.branch = "ECE";
  } else if (/\b(Mechanical Engineering|ME)\b/i.test(text)) {
    suggestions.branch = "Mechanical";
  } else if (/\b(Electrical Engineering|EEE|EE)\b/i.test(text)) {
    suggestions.branch = "Electrical";
  }

  // 5. Year of study detection
  const yearMatch = text.match(/\b([1-4])(?:st|nd|rd|th)?\s*year\b/i) ||
                    text.match(/\b(first|second|third|fourth|final)\s*year\b/i);
  if (yearMatch) {
    const map = { "1": 1, "first": 1, "2": 2, "second": 2, "3": 3, "third": 3, "4": 4, "fourth": 4, "final": 4 };
    const num = map[yearMatch[1].toLowerCase()];
    if (num) suggestions.year = num;
  }

  // 6. Links (GitHub, LinkedIn, Portfolio)
  const ghMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)?/i) ||
                  text.match(/\bgithub\.com\/[a-zA-Z0-9_\-]+/i);
  if (ghMatch) {
    const raw = ghMatch[0];
    suggestions.links.github = raw.startsWith('http') ? raw : `https://${raw}`;
  }

  const liMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-]+/i) ||
                  text.match(/\blinkedin\.com\/in\/[a-zA-Z0-9_\-]+/i);
  if (liMatch) {
    const raw = liMatch[0];
    suggestions.links.linkedin = raw.startsWith('http') ? raw : `https://${raw}`;
  }

  const portMatch = text.match(/https?:\/\/(?:[a-zA-Z0-9\-]+\.)+(?:dev|io|me|app|com)(?:\/[a-zA-Z0-9_\-\/]*)?/i);
  if (portMatch && !portMatch[0].includes('github.com') && !portMatch[0].includes('linkedin.com')) {
    suggestions.links.portfolio = portMatch[0];
  }

  return {
    success: true,
    textLength: text.length,
    suggestions,
    confidence: "medium"
  };
}

/**
 * Processes an in-memory file buffer (PDF or DOCX) and returns suggested profile fields.
 * File is never written to disk.
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
async function processResumeBuffer(buffer, fileName = '', mimeType = '') {
  if (!buffer || buffer.length === 0) {
    return { success: false, error: "Empty file provided." };
  }

  if (buffer.length > 5 * 1024 * 1024) {
    return { success: false, error: "File exceeds 5MB size limit." };
  }

  const lowerName = (fileName || '').toLowerCase();
  let extractedText = '';

  // Validate format and parse
  const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf' || buffer.subarray(0, 4).toString() === '%PDF';
  const isDocx = lowerName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (isPdf) {
    extractedText = await extractTextFromPdfAsync(buffer);
  } else if (isDocx) {
    extractedText = extractTextFromDocx(buffer);
  } else {
    return {
      success: false,
      error: "Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx)."
    };
  }

  const cleanText = sanitizeHumanText(extractedText);

  if (!cleanText || cleanText.trim().length === 0) {
    return {
      success: false,
      error: "Could not extract selectable text from this file. It may be scanned or empty. Manual entry is always available below."
    };
  }

  return suggestProfileFromText(cleanText);
}

/**
 * Extracts plain text from an opportunity document buffer (PDF, DOCX, or TXT).
 * In-memory processing with zero disk writes.
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<object>} { success: boolean, text?: string, textLength?: number, error?: string }
 */
async function extractTextFromFileBuffer(buffer, fileName = '', mimeType = '') {
  if (!buffer || buffer.length === 0) {
    return { success: false, error: "Empty file provided." };
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { success: false, error: "File exceeds 10MB size limit." };
  }

  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || lowerMime.includes('pdf') || buffer.includes('%PDF');
  const isDocx = lowerName.endsWith('.docx') || lowerMime.includes('wordprocessingml') || (buffer[0] === 0x50 && buffer[1] === 0x4b);
  const isTxt = lowerName.endsWith('.txt') || lowerMime.includes('text/plain');

  let text = '';
  if (isPdf) {
    text = await extractTextFromPdfAsync(buffer);
  } else if (isDocx) {
    text = extractTextFromDocx(buffer);
  } else if (isTxt) {
    text = buffer.toString('utf-8');
  } else if (buffer.includes('%PDF')) {
    text = await extractTextFromPdfAsync(buffer);
  } else if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    text = extractTextFromDocx(buffer);
  } else {
    // If predominantly printable text, treat as plain text fallback
    const sample = buffer.subarray(0, 1024).toString('utf-8');
    if (/^[\x09\x0A\x0D\x20-\x7E\xA0-\xFF]+$/.test(sample)) {
      text = buffer.toString('utf-8');
    } else {
      return {
        success: false,
        error: "Unsupported file format. Please upload a PDF (.pdf), Word document (.docx), or text file (.txt)."
      };
    }
  }

  const cleanText = sanitizeHumanText(text);

  if (!cleanText || cleanText.trim().length === 0) {
    return {
      success: false,
      error: "Could not extract readable text from this file. It may be scanned or empty. You can copy and paste the text directly into the box."
    };
  }

  // Filter out non-essential corporate boilerplates (About us, Perks, EEO statements)
  // to strictly isolate job requirements, eligibility, qualifications, and timeline
  const essentialText = filterEssentialOpportunityText(cleanText);

  return {
    success: true,
    text: essentialText.trim(),
    textLength: essentialText.trim().length,
    rawLength: cleanText.trim().length
  };
}

module.exports = {
  extractTextFromPdf,
  extractTextFromPdfSync,
  extractTextFromPdfAsync,
  extractTextFromDocx,
  suggestProfileFromText,
  processResumeBuffer,
  extractTextFromFileBuffer,
  sanitizeHumanText,
  isPredominantlyHumanText,
  KNOWN_SKILLS_DICTIONARY,
  SKILL_ALIASES
};
