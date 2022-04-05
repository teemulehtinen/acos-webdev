const path = require('path');
const fs = require('fs');
const readline = require('readline');
const events = require('events');

if (process.argv.length < 5) {
  console.log(`Usage: [beg_date] [end_date] [log_files]`);
  console.log('  Date formatted as YYMMDD.');
  process.exit(0);
}

const parseToDate = (s, t) => new Date(`20${s.substr(0, 2)}-${s.substr(2, 2)}-${s.substr(4, 2)}T${t}`);
const beg = parseToDate(process.argv[2], '00:00:00.000');
const end = parseToDate(process.argv[3], '23:59:59.999');

const filterLog = async (filePath, newFilePath) => {
  const lines = [];
  const bySession = {};
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  rl.on('line', line => {
    const [ts, pl, pr] = line.split('\t');
    const day = new Date(ts);
    if (day >= beg && day <= end) {
      const payload = JSON.parse(pl);
      if (payload.session !== undefined) {
        if (bySession[payload.session] !== undefined) {
          lines[bySession[payload.session]] = null;
        }
        bySession[payload.session] = lines.length;
        lines.push(line);
      }
    }
  });
  await events.once(rl, 'close');
  delete bySession;
  fs.writeFileSync(newFilePath, lines.filter(l => l !== null).join('\n'));
};

(async () => {
  for (const filePath of process.argv.slice(4)) {
    const parsed = path.parse(filePath);
    const newFilePath = `${parsed.name}_${process.argv[2]}-${process.argv[3]}.log`;
    console.log(`Extracting ${filePath} to ${newFilePath}`);
    await filterLog(filePath, newFilePath);
  }
})();
