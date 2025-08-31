// Uso: node scripts/generate-hash.js <password>
const bcrypt = require('bcryptjs');

async function main() {
  const pwd = process.argv[2];
  if (!pwd) {
    console.error('Uso: node scripts/generate-hash.js <password>');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(pwd, 10);
    console.log('Hash bcrypt:', hash);
  } catch (e) {
    console.error('Error generando hash:', e);
    process.exit(1);
  }
}

main();
