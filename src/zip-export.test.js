import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createScriptZip } from './zip-export.js';

test('createScriptZip contains all language scripts', async () => {
  const blob = await createScriptZip({
    shell:      'echo sh\n',
    powershell: 'Write-Host ps1\n',
    python:     'print("py")\n',
    go:         'fmt.Println("go")\n',
    rust:       'println!("rs");\n',
    javascript: 'console.log("js")\n',
  });
  const buffer = Buffer.from(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  assert.equal(await zip.file('banner.sh').async('string'),  'echo sh\n');
  assert.equal(await zip.file('banner.ps1').async('string'), 'Write-Host ps1\n');
  assert.equal(await zip.file('banner.py').async('string'),  'print("py")\n');
  assert.equal(await zip.file('banner.go').async('string'),  'fmt.Println("go")\n');
  assert.equal(await zip.file('banner.rs').async('string'),  'println!("rs");\n');
  assert.equal(await zip.file('banner.js').async('string'),  'console.log("js")\n');
});
