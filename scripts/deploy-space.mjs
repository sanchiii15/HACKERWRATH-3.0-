// Deploys the committed code to a Hugging Face Space as a single snapshot commit.
// The Space only needs the current files; sending no history avoids its rejection of
// old binary files and keeps the push small.
// Usage: npm run deploy:space            (remote named "space")
//        npm run deploy:space -- myremote
import { execFileSync } from 'node:child_process';

const remote = process.argv[2] || 'space';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

try {
  git('remote', 'get-url', remote);
} catch {
  console.error(`No git remote named "${remote}". Add it first:\n  git remote add ${remote} https://huggingface.co/spaces/<user>/<space>`);
  process.exit(1);
}

if (git('status', '--porcelain')) {
  console.warn('Note: uncommitted changes are NOT deployed; only the last commit is.');
}

const head = git('rev-parse', '--short', 'HEAD');
const snapshot = git('commit-tree', 'HEAD^{tree}', '-m', `Deploy ${head}`);
console.log(`Pushing snapshot of ${head} to ${remote}/main…`);
execFileSync('git', ['push', remote, `${snapshot}:refs/heads/main`, '--force'], { stdio: 'inherit' });
console.log('Done. The Space rebuilds automatically; watch progress under Logs → Build.');
