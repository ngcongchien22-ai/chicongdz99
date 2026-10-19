/* ═══════════ XỬ LÝ ONBOARDING VIEW ═══════════ */
document.getElementById('closeOnboardingBtn').addEventListener('click', (e) => {
  e.preventDefault();
  const overlay = document.getElementById('onboardingView');
  overlay.classList.add('hidden');
  setTimeout(() => {
    overlay.remove();
  }, 300);
});

/* ═══════════ KẾT NỐI GOOGLE SHEETS & TRÌNH PHÁT NHẠC ═══════════ */
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1WJq4EWe-hlahMC0GPcLkjYkKXcDJnA6FX4f-pVgCTpY/export?format=csv';

const audioEl = document.getElementById('bgAudio');
const songSelect = document.getElementById('songSelect');
const togglePlayBtn = document.getElementById('togglePlayBtn');
let isPlaying = false;

async function loadPlaylistFromGoogleSheets() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    const rows = csvText.split('\n').map(r => r.split(','));
    let playlist = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) {
        let name = row[0].replace(/^"|"$/g, '').trim();
        let link = row.slice(1).join(',').replace(/^"|"$/g, '').trim();
        if (name && link) {
          playlist.push({ name, link });
        }
      }
    }

    if (playlist.length > 0) {
      songSelect.innerHTML = '<option value="">-- Chọn bài hát --</option>';
      playlist.forEach((song, index) => {
        const opt = document.createElement('option');
        opt.value = song.link;
        opt.textContent = `${index + 1}. ${song.name}`;
        songSelect.appendChild(opt);
      });
      audioEl.src = playlist[0].link;
      songSelect.value = playlist[0].link;
    } else {
      songSelect.innerHTML = '<option value="">Không có bài hát nào trong Sheets</option>';
    }
  } catch (err) {
    console.error('Lỗi tải danh sách nhạc:', err);
    songSelect.innerHTML = '<option value="">Lỗi kết nối Google Sheets</option>';
  }
}

songSelect.addEventListener('change', () => {
  const selectedUrl = songSelect.value;
  if (!selectedUrl) return;
  audioEl.src = selectedUrl;
  if (isPlaying) {
    audioEl.play().catch(e => console.log('Không thể phát:', e));
  }
});

togglePlayBtn.addEventListener('click', () => {
  if (!audioEl.src) {
    alert('Vui lòng chọn bài hát trước!');
    return;
  }
  
  if (isPlaying) {
    audioEl.pause();
    isPlaying = false;
    togglePlayBtn.textContent = 'Bật nhạc';
    togglePlayBtn.style.background = 'linear-gradient(135deg,#2E63DB,#6040C8)';
  } else {
    audioEl.play().then(() => {
      isPlaying = true;
      togglePlayBtn.textContent = 'Tắt nhạc';
      togglePlayBtn.style.background = 'linear-gradient(135deg,#E85060,#E8A030)';
    }).catch(e => {
      alert('Trình duyệt chặn phát tự động, hãy bấm chọn bài trước.');
    });
  }
});

loadPlaylistFromGoogleSheets();

/* ═══════════ TIỆN ÍCH ═══════════ */
const $ = s => document.querySelector(s);
const hx = n => n.toString(16);
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const a4 = n => (n + 3) & ~3;

const CRC_TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = b => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TAB[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
const enc = s => new TextEncoder().encode(s);

/* ═══════════ LZ4 ═══════════ */
function lz4dec(src, outSize){
  const dst = new Uint8Array(outSize);
  const n = src.length;
  let i = 0, o = 0;
  while (i < n){
    const tok = src[i++];
    let lit = tok >> 4;
    if (lit === 15){
      let b;
      do { if (i >= n) throw new Error('LZ4: hết dữ liệu ở độ dài literal'); b = src[i++]; lit += b; }
      while (b === 255);
    }
    if (lit){
      if (i + lit > n) throw new Error('LZ4: literal vượt biên');
      if (o + lit > outSize) throw new Error('LZ4: literal vượt kích thước đầu ra');
      dst.set(src.subarray(i, i + lit), o);
      i += lit; o += lit;
    }
    if (i >= n) break;
    const off = src[i] | (src[i+1] << 8); i += 2;
    if (off === 0 || off > o) throw new Error(`LZ4: offset không hợp lệ (${off})`);
    let ml = tok & 15;
    if (ml === 15){
      let b;
      do { if (i >= n) throw new Error('LZ4: hết dữ liệu ở độ dài match'); b = src[i++]; ml += b; }
      while (b === 255);
    }
    ml += 4;
    if (o + ml > outSize) throw new Error('LZ4: match vượt kích thước đầu ra');
    let sp = o - off;
    for (let k = 0; k < ml; k++) dst[o++] = dst[sp++];
  }
  if (o !== outSize) throw new Error(`LZ4: giải ra ${o} byte, cần ${outSize}`);
  return dst;
}

function lz4enc(src){
  const n = src.length;
  if (!n) return new Uint8Array(0);
  const out = [];
  const HLOG = 16, HSIZE = 1 << HLOG;
  const head = new Int32Array(HSIZE).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const MFLIMIT = 12, LASTLIT = 5, MAXDIST = 65535, CHAIN = 32;

  const h4 = i => {
    const v = (src[i] | (src[i+1]<<8) | (src[i+2]<<16) | (src[i+3]<<24)) >>> 0;
    return (Math.imul(v, 2654435761) >>> (32 - HLOG));
  };
  const same4 = (a, b) =>
    src[a]===src[b] && src[a+1]===src[b+1] && src[a+2]===src[b+2] && src[a+3]===src[b+3];

  const emit = (ls, le, mlen, moff) => {
    const litlen = le - ls;
    const ml = mlen ? mlen - 4 : 0;
    out.push(((litlen >= 15 ? 15 : litlen) << 4) | (ml >= 15 ? 15 : ml));
    if (litlen >= 15){
      let r = litlen - 15;
      while (r >= 255){ out.push(255); r -= 255; }
      out.push(r);
    }
    for (let k = ls; k < le; k++) out.push(src[k]);
    if (mlen){
      out.push(moff & 255, (moff >> 8) & 255);
      if (ml >= 15){
        let r = ml - 15;
        while (r >= 255){ out.push(255); r -= 255; }
        out.push(r);
      }
    }
  };

  let anchor = 0, i = 0;
  while (i < n - MFLIMIT){
    const hv = h4(i);
    let bestLen = 0, bestOff = 0, cur = head[hv], cnt = 0;
    while (cur >= 0 && cnt < CHAIN){
      const off = i - cur;
      if (off > MAXDIST) break;
      if (same4(cur, i)){
        let l = 4;
        const lim = n - LASTLIT - i;
        while (l < lim && src[cur+l] === src[i+l]) l++;
        if (l > bestLen){ bestLen = l; bestOff = off; if (l >= 255) break; }
      }
      cur = prev[cur]; cnt++;
    }
    prev[i] = head[hv]; head[hv] = i;

    if (bestLen >= 4){
      emit(anchor, i, bestLen, bestOff);
      const stop = Math.min(i + bestLen, n - 3);
      for (let k = i + 1; k < stop; k++){ const hk = h4(k); prev[k] = head[hk]; head[hk] = k; }
      i += bestLen; anchor = i;
    } else i++;
  }
  const litlen = n - anchor;
  out.push((litlen >= 15 ? 15 : litlen) << 4);
  if (litlen >= 15){
    let r = litlen - 15;
    while (r >= 255){ out.push(255); r -= 255; }
    out.push(r);
  }
  for (let k = anchor; k < n; k++) out.push(src[k]);
  return new Uint8Array(out);
}

function lz4Trace(src, outSize){
  const litOf  = new Int32Array(outSize).fill(-1);
  const copyOf = new Int32Array(outSize).fill(-1);
  let i = 0, o = 0;
  while (i < src.length && o < outSize){
    const tok = src[i++];
    let lit = tok >> 4;
    if (lit === 15){ let b; do { b = src[i++]; lit += b; } while (b === 255); }
    for (let k = 0; k < lit; k++){ litOf[o++] = i++; }
    if (i >= src.length) break;
    const off = src[i] | (src[i+1] << 8); i += 2;
    let ml = tok & 15;
    if (ml === 15){ let b; do { b = src[i++]; ml += b; } while (b === 255); }
    ml += 4;
    let sp = o - off;
    for (let k = 0; k < ml; k++){ copyOf[o] = sp; o++; sp++; }
  }
  const root = new Int32Array(outSize).fill(-1);
  for (let k = 0; k < outSize; k++){
    let cur = k, guard = 0;
    while (litOf[cur] < 0 && copyOf[cur] >= 0 && guard++ < outSize) cur = copyOf[cur];
    root[k] = litOf[cur] >= 0 ? litOf[cur] : -1;
  }
  return root;
}

/* ═══════════ UnityFS & Khác ═══════════ */
function parseBundle(u8){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 0;
  const cstr = () => { let s = ''; while (u8[p]) s += String.fromCharCode(u8[p++]); p++; return s; };
  const sig = cstr();
  if (sig !== 'UnityFS') throw new Error(`Không phải UnityFS bundle (signature "${sig}")`);
  const fmt = dv.getUint32(p, false); p += 4;
  const uv = cstr(), rev = cstr();
  const declared = Number(dv.getBigInt64(p, false)); p += 8;
  const ciSize = dv.getUint32(p, false); p += 4;
  const uiSize = dv.getUint32(p, false); p += 4;
  const flags  = dv.getUint32(p, false); p += 4;
  const headerEnd = p;
  const ic = flags & 0x3F;

  let infoOff, info, dataStart;
  if (flags & 0x80){
    dataStart = (headerEnd + 15) & ~15;
    infoOff = null;
    const from = Math.min(declared, u8.length) - ciSize;
    for (let off = from; off >= Math.max(0, from - 80000); off--){
      try {
        const cand = (ic === 2 || ic === 3)
          ? lz4dec(u8.subarray(off, off + ciSize), uiSize)
          : u8.subarray(off, off + ciSize).slice();
        info = cand; infoOff = off; break;
      } catch (e) { }
    }
    if (infoOff === null) throw new Error('Không tìm được blocksInfo ở cuối file.');
  } else {
    if (fmt >= 7 || (flags & 0x200)) p = (p + 15) & ~15;
    infoOff = p;
    const infoRaw = u8.subarray(p, p + ciSize);
    if (ic === 2 || ic === 3) info = lz4dec(infoRaw, uiSize);
    else if (ic === 0) info = infoRaw.slice();
    else throw new Error(`blocksInfo nén kiểu ${ic}`);
    dataStart = infoOff + ciSize;
    if (flags & 0x200) dataStart = (dataStart + 15) & ~15;
  }

  const idv = new DataView(info.buffer, info.byteOffset, info.byteLength);
  let q = 16;
  const nB = idv.getUint32(q, false); q += 4;
  const blocks = [];
  for (let i = 0; i < nB; i++){
    blocks.push({ u: idv.getUint32(q,false), c: idv.getUint32(q+4,false), f: idv.getUint16(q+8,false) });
    q += 10;
  }
  const nN = idv.getUint32(q, false); q += 4;
  const nodes = [];
  for (let i = 0; i < nN; i++){
    const off = Number(idv.getBigInt64(q,false)), sz = Number(idv.getBigInt64(q+8,false));
    const nf = idv.getUint32(q+16,false); q += 20;
    let nm = ''; while (info[q]) nm += String.fromCharCode(info[q++]); q++;
    nodes.push({ off, size: sz, flags: nf, name: nm });
  }
  return { fmt, uv, rev, declared, ciSize, uiSize, flags, blocks, nodes, dataStart, infoOff, info, headerEnd };
}

function parseSF(cab){
  const dv = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
  const version = dv.getUint32(8, false);
  if (version !== 22) throw new Error(`SerializedFile v${version}`);
  const metaSize = dv.getUint32(20, false);
  const fileSize = Number(dv.getBigInt64(24, false));
  const dataOffset = Number(dv.getBigInt64(32, false));

  let p = 48;
  const cstr = () => { let s=''; while (cab[p]) s += String.fromCharCode(cab[p++]); p++; return s; };
  const unityVer = cstr();
  const target = dv.getInt32(p, true); p += 4;
  const hasTT = cab[p]; p += 1;

  const i32 = () => { const v = dv.getInt32(p, true); p += 4; return v; };
  const tcount = i32();
  const types = [];
  for (let i = 0; i < tcount; i++){
    const cid = i32();
    p += 3;
    if (cid === 114) p += 16;
    const th = cab.slice(p, p+16); p += 16;
    let nodes = null, sb = null;
    if (hasTT){
      const nn = i32(), sbs = i32();
      nodes = [];
      for (let k = 0; k < nn; k++){
        const ver = dv.getUint16(p, true);
        const level = cab[p+2], tflags = cab[p+3];
        const to = dv.getUint32(p+4, true), no = dv.getUint32(p+8, true);
        const bsize = dv.getInt32(p+12, true), idx = dv.getInt32(p+16, true), meta = dv.getInt32(p+20, true);
        p += 32;
        nodes.push({ ver, level, tflags, to, no, bsize, idx, meta });
      }
      sb = cab.slice(p, p + sbs); p += sbs;
      const nd = i32(); p += nd * 4;
    }
    types.push({ cid, th, nodes, sb });
  }

  const ocount = i32();
  const objs = [];
  for (let i = 0; i < ocount; i++){
    p = a4(p);
    const ent = p;
    const pid = dv.getBigInt64(p, true);
    const off = Number(dv.getBigInt64(p+8, true));
    const size = dv.getUint32(p+16, true);
    const tid = dv.getInt32(p+20, true);
    p += 24;
    objs.push({ pid, off, size, tid, cid: types[tid].cid, ent });
  }
  return { version, metaSize, fileSize, dataOffset, unityVer, target, hasTT, types, objs, cab };
}

const COMMON = "AABB\0AnimationClip\0AnimationCurve\0AnimationState\0Array\0Base\0BitField\0bitset\0bool\0char\0ColorRGBA\0Component\0data\0deque\0double\0dynamic_array\0FastPropertyName\0first\0float\0Font\0GameObject\0Generic Mono\0GradientNEW\0GUID\0GUIStyle\0int\0list\0long long\0map\0Matrix4x4f\0MdFour\0MonoBehaviour\0MonoScript\0m_ByteSize\0m_Curve\0m_EditorClassIdentifier\0m_EditorHideFlags\0m_Enabled\0m_ExtensionPtr\0m_GameObject\0m_Index\0m_IsArray\0m_IsStatic\0m_MetaFlag\0m_Name\0m_ObjectHideFlags\0m_PrefabInternal\0m_PrefabParentObject\0m_Script\0m_StaticEditorFlags\0m_Type\0m_Version\0Object\0pair\0PPtr<Component>\0PPtr<GameObject>\0PPtr<Material>\0PPtr<MonoBehaviour>\0PPtr<MonoScript>\0PPtr<Object>\0PPtr<Prefab>\0PPtr<Sprite>\0PPtr<TextAsset>\0PPtr<Texture>\0PPtr<Texture2D>\0PPtr<Transform>\0Prefab\0Quaternionf\0Rectf\0RectInt\0RectOffset\0second\0set\0short\0size\0SInt16\0SInt32\0SInt64\0SInt8\0staticvector\0string\0TextAsset\0TextMesh\0Texture\0Texture2D\0Transform\0TypelessData\0UInt16\0UInt32\0UInt64\0UInt8\0unsigned int\0unsigned long long\0unsigned short\0vector\0Vector2f\0Vector3f\0Vector4f\0m_ScriptingClassIdentifier\0Gradient\0Type*\0int2_storage\0int3_storage\0BoundsInt\0m_CorrespondingSourceObject\0m_PrefabInstance\0m_PrefabAsset\0FileSize\0Hash128\0";
const COMMON_B = enc(COMMON);

function sname(sb, off){
  const buf = (off & 0x80000000) ? COMMON_B : sb;
  let o = off & 0x7fffffff, s = '';
  while (buf[o]) s += String.fromCharCode(buf[o++]);
  return s;
}
function buildNodes(t){
  return t.nodes.map(n => ({
    type: sname(t.sb, n.to), name: sname(t.sb, n.no),
    level: n.level, meta: n.meta
  }));
}

function makeReader(data){
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { data, dv, p: 0, align(){ this.p = a4(this.p); } };
}
function readVal(nodes, i, r, trace){
  const n = nodes[i];
  const t = n.type;
  const doAlign = (n.meta & 0x4000) !== 0;
  const kids = [];
  let j = i + 1;
  while (j < nodes.length && nodes[j].level > n.level){
    if (nodes[j].level === n.level + 1) kids.push(j);
    j++;
  }
  let v;
  switch (t){
    case 'SInt8':  v = r.dv.getInt8(r.p);  r.p += 1; break;
    case 'UInt8': case 'char': v = r.data[r.p]; r.p += 1; break;
    case 'SInt16': case 'short': v = r.dv.getInt16(r.p,true); r.p += 2; break;
    case 'UInt16': case 'unsigned short': v = r.dv.getUint16(r.p,true); r.p += 2; break;
    case 'SInt32': case 'int': case 'Type*': v = r.dv.getInt32(r.p,true); r.p += 4; break;
    case 'UInt32': case 'unsigned int': v = r.dv.getUint32(r.p,true); r.p += 4; break;
    case 'SInt64': case 'long long': v = r.dv.getBigInt64(r.p,true); r.p += 8; break;
    case 'UInt64': case 'unsigned long long': case 'FileSize':
      v = r.dv.getBigUint64(r.p,true); r.p += 8; break;
    case 'float':  v = r.dv.getFloat32(r.p,true); r.p += 4; break;
    case 'double': v = r.dv.getFloat64(r.p,true); r.p += 8; break;
    case 'bool':   v = r.data[r.p] !== 0; r.p += 1; break;
    case 'string': {
      const st = r.p;
      const ln = r.dv.getInt32(r.p,true); r.p += 4;
      v = new TextDecoder().decode(r.data.subarray(r.p, r.p+ln)); r.p += ln;
      r.align();
      if (trace) trace.push({ node: n.name, start: st, len: ln, val: v });
      break;
    }
    case 'TypelessData': {
      const ln = r.dv.getInt32(r.p,true); r.p += 4;
      v = r.data.slice(r.p, r.p+ln); r.p += ln;
      break;
    }
    default: {
      if (kids.length && nodes[kids[0]].type === 'Array'){
        const ai = kids[0];
        const ak = [];
        let k = ai + 1;
        while (k < nodes.length && nodes[k].level > nodes[ai].level){
          if (nodes[k].level === nodes[ai].level + 1) ak.push(k);
          k++;
        }
        const size = r.dv.getInt32(r.p,true); r.p += 4;
        v = [];
        for (let m = 0; m < size; m++) v.push(readVal(nodes, ak[1], r, trace));
        if (nodes[ai].meta & 0x4000) r.align();
      } else {
        v = {};
        for (const c of kids) v[nodes[c].name] = readVal(nodes, c, r, trace);
      }
    }
  }
  if (doAlign) r.align();
  return v;
}

function objBody(sf, o){ return sf.cab.subarray(sf.dataOffset + o.off, sf.dataOffset + o.off + o.size); }
function readObj(sf, o, trace){
  const nodes = buildNodes(sf.types[o.tid]);
  const r = makeReader(objBody(sf, o));
  const v = readVal(nodes, 0, r, trace);
  return v;
}

/* Các preset xử lý game */
const HIPS = enc('bone_Hips'), NECK = enc('bone_Neck');
const H_HIPS = crc32(HIPS), H_NECK = crc32(NECK);

function findSwapTargets(u8, from, to){
  const hits = [];
  const want = [
    { nm: HIPS, lb:'bone_Hips', h: H_HIPS, ot: NECK, ol:'bone_Neck', cons:true  },
    { nm: NECK, lb:'bone_Neck', h: H_NECK, ot: HIPS, ol:'bone_Hips', cons:true  },
    { nm: HIPS, lb:'bone_Hips', h: H_NECK, ot: NECK, ol:'bone_Neck', cons:false },
    { nm: NECK, lb:'bone_Neck', h: H_HIPS, ot: HIPS, ol:'bone_Hips', cons:false }
  ];
  for (const w of want){
    const pat = new Uint8Array(20);
    const pv = new DataView(pat.buffer);
    pv.setInt32(0, 9, true);
    pat.set(w.nm, 4);
    pv.setUint32(16, w.h, true);
    for (let i = from; i <= to - 20; i++){
      let ok = true;
      for (let k = 0; k < 20; k++) if (u8[i+k] !== pat[k]) { ok = false; break; }
      if (ok) hits.push({ at: i + 4, ...w });
    }
  }
  return hits.sort((a,b) => a.at - b.at);
}

function applyPreset1(orig, b){
  const node = b.nodes[0];
  if (b.blocks.some(x => (x.f & 0x3F) !== 0))
    throw new Error('Bundle có block bị nén.');
  const from = b.dataStart + node.off, to = from + node.size;
  const hits = findSwapTargets(orig, from, to);
  if (!hits.length) throw new Error('Không tìm thấy cặp bone tương ứng.');
  const out = orig.slice();
  for (const h of hits) out.set(h.ot, h.at);
  const rows = hits.map(h => [`0x${hx(h.at).padStart(5,'0')}`, String(h.h), h.lb, h.ol]);
  return { out, note: `Đã xử lý xong ${hits.length} mục tiêu.`, cols: ['Offset','Hash','Trước','Sau'], rows };
}

/* Giao diện logic chung */
let FILE = null, ORIG = null, BUN = null, KIND = null, DET = null;
function render(el, html){ $(el).innerHTML = html; }

async function load(file){
  FILE = file; ORIG = null; BUN = null; KIND = null; DET = null;
  $('#go').disabled = true;
  render('#out', '');
  let buf;
  try { buf = await file.arrayBuffer(); } catch(e){ return; }
  ORIG = new Uint8Array(buf);
  try { BUN = parseBundle(ORIG); } catch(e){ return; }
  KIND = 'shader'; // Giả lập trạng thái load thành công
  $('#go').disabled = false;
  render('#info', `<div class="panel"><h2>File nguồn</h2><table><tr><td>Tên</td><td>${esc(file.name)}</td></tr><tr><td>Dung lượng</td><td>${ORIG.length.toLocaleString('vi-VN')} byte</td></tr></table></div>`);
}

$('#go').onclick = async () => {
  const btn = $('#go');
  btn.disabled = true;
  btn.textContent = 'Đang xử lý…';
  let res;
  try {
    res = applyPreset1(ORIG, BUN);
  } catch(e){
    render('#out', `<div class="msg bad">${esc(e.message)}</div>`);
    btn.disabled = false;
    btn.textContent = 'Tạo file';
    return;
  }
  btn.disabled = false;
  btn.textContent = 'Tạo file';

  render('#out', `
    <div class="msg ok">${res.note}</div>
    <div class="panel"><h2>Kết quả</h2>
    <span class="fname">${esc(FILE.name)}</span>
    <div class="row" style="margin-top:14px"><button id="dl" type="button">Tải file đã sửa</button></div></div>`);

  // --- SỬA LẠI PHẦN TẢI FILE ĐỂ KHÔNG BỊ LIỆT GIAO DIỆN ---
  $('#dl').onclick = () => {
    // Gửi tín hiệu ngầm sang Vercel/Bot Telegram mà không block hay đóng app đột ngột
    const chatId = Telegram.WebApp.initDataUnsafe.user?.id;
    if (chatId) {
      fetch('https://chicongdz99.vercel.app/api/tao-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, filename: FILE.name })
      }).catch(err => console.log(err));
    }

    // Thực hiện tải file xuống máy bình thường
    const url = URL.createObjectURL(new Blob([res.out], { type:'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = FILE.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
};

const input = $('#file'), drop = $('#drop');
drop.onclick = () => input.click();
input.onchange = () => { if (input.files[0]) load(input.files[0]); };
