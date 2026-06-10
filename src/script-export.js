import { ansiLines } from './render.js';

export function generateShellScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `#!/bin/sh

print_truecolor_banner() {
${shellPrintfLines(variants.truecolorLines)}
}

print_256_banner() {
${shellPrintfLines(variants.color256Lines)}
}

print_16_banner() {
${shellPrintfLines(variants.color16Lines)}
}

print_plain_banner() {
${shellPrintfLines(variants.plainLines)}
}

color_count="$(tput colors 2>/dev/null || echo 0)"

if [ "\${NO_COLOR+x}" = "x" ] || [ "\${TERM:-}" = "dumb" ]; then
    print_plain_banner
elif [ "\${COLORTERM:-}" = "truecolor" ] || [ "\${COLORTERM:-}" = "24bit" ]; then
    print_truecolor_banner
elif [ "$color_count" -ge 256 ]; then
    print_256_banner
elif [ "$color_count" -ge 8 ]; then
    print_16_banner
else
    print_plain_banner
fi
`;
}

export function generatePowerShellScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `# Enable ANSI color support on Windows PowerShell 5.1 (PS7+ does this automatically)
if ($PSVersionTable.PSVersion.Major -lt 7 -and [System.Environment]::OSVersion.Platform -eq 'Win32NT') {
    try {
        $outHandle = (Add-Type -MemberDefinition '
            [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int h);
            [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out uint m);
            [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m);
        ' -Name Kernel32 -Namespace Win32 -PassThru)::GetStdHandle(-11)
        $mode = 0
        [Win32.Kernel32]::GetConsoleMode($outHandle, [ref]$mode) | Out-Null
        [Win32.Kernel32]::SetConsoleMode($outHandle, $mode -bor 4) | Out-Null
    } catch {}
}

function Print-TruecolorBanner {
${powerShellWriteLines(variants.truecolorLines)}
}

function Print-256Banner {
${powerShellWriteLines(variants.color256Lines)}
}

function Print-16Banner {
${powerShellWriteLines(variants.color16Lines)}
}

function Print-PlainBanner {
${powerShellWriteLines(variants.plainLines)}
}

if ($null -ne [System.Environment]::GetEnvironmentVariable('NO_COLOR') -or $env:TERM -eq "dumb") {
    Print-PlainBanner
} elseif ($env:COLORTERM -eq "truecolor" -or $env:COLORTERM -eq "24bit" -or $env:WT_SESSION) {
    Print-TruecolorBanner
} elseif ($env:TERM -like "*256color*") {
    Print-256Banner
} else {
    Print-16Banner
}
`;
}

function variantsFromRows(rows, colors) {
  return {
    plainLines: rows,
    truecolorLines: ansiLines(rows, colors, 'truecolor'),
    color256Lines: ansiLines(rows, colors, '256'),
    color16Lines: ansiLines(rows, colors, '16'),
  };
}

function shellPrintfLines(lines) {
  return lines.map((line) => `    printf '%b\\n' '${escapeShellSingleQuoted(escapeAnsi(line))}'`).join('\n');
}

function escapeAnsi(value) {
  return value.replaceAll('\x1b', '\\033');
}

function powerShellWriteLines(lines) {
  return lines.map((line) => `    Write-Host '${escapePowerShellSingleQuoted(line)}'`).join('\n');
}

function escapeShellSingleQuoted(value) {
  return value.replaceAll("'", "'\\''");
}

function escapePowerShellSingleQuoted(value) {
  return value.replaceAll("'", "''");
}
