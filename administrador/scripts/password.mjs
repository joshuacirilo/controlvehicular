import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Must produce the same format that server/auth/password.ts verifies.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function promptHidden(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = text => { if (!muted) rl.output.write(text); };
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

/** Reads a password from `envName` or prompts twice without echo; exits on mismatch or bad length. */
export async function readPassword(envName, minLength) {
  let password = process.env[envName];
  if (!password) {
    password = await promptHidden('Contrasena: ');
    if (password !== await promptHidden('Repite la contrasena: ')) {
      console.error('ERROR: las contrasenas no coinciden.');
      process.exit(1);
    }
  }
  if (password.length < minLength || password.length > 128) {
    console.error(`ERROR: la contrasena debe tener entre ${minLength} y 128 caracteres.`);
    process.exit(1);
  }
  return password;
}
