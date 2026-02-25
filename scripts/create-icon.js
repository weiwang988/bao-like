const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIcon() {
  try {
    // 读取SVG文件
    const svgBuffer = fs.readFileSync(path.join(__dirname, '..', 'public', 'icon.svg'));
    
    // 生成不同尺寸的PNG文件
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const size of sizes) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      pngBuffers.push({
        width: size,
        height: size,
        buffer: pngBuffer
      });
      
      // 保存单独的PNG文件用于验证
      fs.writeFileSync(path.join(__dirname, '..', 'public', `icon-${size}.png`), pngBuffer);
    }
    
    console.log('PNG图标文件已生成');
    
    // 创建ICO文件（Windows图标格式）
    // ICO文件结构相对复杂，这里创建一个基础的ICO文件
    await createICOFile(pngBuffers);
    
  } catch (error) {
    console.error('创建图标时出错:', error);
  }
}

async function createICOFile(pngBuffers) {
  // ICO文件头
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 保留字段
  header.writeUInt16LE(1, 2); // 图标类型
  header.writeUInt16LE(pngBuffers.length, 4); // 图标数量
  
  // 图标目录项
  const directoryEntries = [];
  let offset = 6 + (pngBuffers.length * 16); //头 +目录项的偏移量
  
  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width === 256 ? 0 : width, 0); //宽度
    entry.writeUInt8(height === 256 ? 0 : height, 1); //高度
    entry.writeUInt8(0, 2); //数
    entry.writeUInt8(0, 3); // 保留
    entry.writeUInt16LE(1, 4); //平面数
    entry.writeUInt16LE(32, 6); // 位深度
    entry.writeUInt32LE(buffer.length, 8); // 图像大小
    entry.writeUInt32LE(offset, 12); // 图像数据偏移量
    
    directoryEntries.push(entry);
    offset += buffer.length;
  }
  
  //组合ICO文件
  const icoBuffers = [header, ...directoryEntries, ...pngBuffers.map(p => p.buffer)];
  const icoBuffer = Buffer.concat(icoBuffers);
  
  // 保存ICO文件
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon.ico'), icoBuffer);
  console.log('ICO文件已生成: public/icon.ico');
}

//执行图标创建
createIcon();