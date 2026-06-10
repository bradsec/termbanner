import JSZip from 'jszip';

export async function createScriptZip({ shell, powershell, python, go, rust, javascript }) {
  const zip = new JSZip();
  zip.file('banner.sh', shell);
  zip.file('banner.ps1', powershell);
  zip.file('banner.py', python);
  zip.file('banner.go', go);
  zip.file('banner.rs', rust);
  zip.file('banner.js', javascript);
  return zip.generateAsync({ type: 'blob' });
}
