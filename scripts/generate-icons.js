const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const SVG_PATH = path.join(__dirname, '..', 'public', 'icon.svg')
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-384.png', size: 384 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon-180.png', size: 180 },
]

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const svgBuffer = fs.readFileSync(SVG_PATH)

  for (const { name, size } of sizes) {
    const outPath = path.join(OUT_DIR, name)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`Generated: ${outPath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
