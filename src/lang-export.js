import { ansiLines } from './render.js';

export function generatePythonScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `#!/usr/bin/env python3
import os

def print_truecolor_banner():
${pythonPrintLines(variants.truecolorLines)}

def print_256_banner():
${pythonPrintLines(variants.color256Lines)}

def print_16_banner():
${pythonPrintLines(variants.color16Lines)}

def print_plain_banner():
${pythonPrintLines(variants.plainLines)}

def print_banner():
    if 'NO_COLOR' in os.environ or os.environ.get('TERM') == 'dumb':
        print_plain_banner()
    elif os.environ.get('COLORTERM') in ('truecolor', '24bit'):
        print_truecolor_banner()
    elif '256color' in os.environ.get('TERM', ''):
        print_256_banner()
    else:
        print_16_banner()

if __name__ == '__main__':
    print_banner()
`;
}

export function generateGoScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `package main

import (
\t"fmt"
\t"os"
\t"strings"
)

func printTruecolorBanner() {
${goPrintLines(variants.truecolorLines)}
}

func print256Banner() {
${goPrintLines(variants.color256Lines)}
}

func print16Banner() {
${goPrintLines(variants.color16Lines)}
}

func printPlainBanner() {
${goPrintLines(variants.plainLines)}
}

func main() {
\t_, noColor := os.LookupEnv("NO_COLOR")
\tterm := os.Getenv("TERM")
\tcolorterm := os.Getenv("COLORTERM")

\tif noColor || term == "dumb" {
\t\tprintPlainBanner()
\t} else if colorterm == "truecolor" || colorterm == "24bit" {
\t\tprintTruecolorBanner()
\t} else if strings.Contains(term, "256color") {
\t\tprint256Banner()
\t} else {
\t\tprint16Banner()
\t}
}
`;
}

export function generateRustScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `use std::env;

fn print_truecolor_banner() {
${rustPrintLines(variants.truecolorLines)}
}

fn print_256_banner() {
${rustPrintLines(variants.color256Lines)}
}

fn print_16_banner() {
${rustPrintLines(variants.color16Lines)}
}

fn print_plain_banner() {
${rustPrintLines(variants.plainLines)}
}

fn main() {
\tlet no_color = env::var_os("NO_COLOR").is_some();
\tlet term = env::var("TERM").unwrap_or_default();
\tlet colorterm = env::var("COLORTERM").unwrap_or_default();

\tif no_color || term == "dumb" {
\t\tprint_plain_banner();
\t} else if colorterm == "truecolor" || colorterm == "24bit" {
\t\tprint_truecolor_banner();
\t} else if term.contains("256color") {
\t\tprint_256_banner();
\t} else {
\t\tprint_16_banner();
\t}
}
`;
}

export function generateJavaScriptScript(input, colors) {
  const variants = Array.isArray(input) ? variantsFromRows(input, colors) : input;

  return `#!/usr/bin/env node
'use strict';

function printTruecolorBanner() {
${jsPrintLines(variants.truecolorLines)}
}

function print256Banner() {
${jsPrintLines(variants.color256Lines)}
}

function print16Banner() {
${jsPrintLines(variants.color16Lines)}
}

function printPlainBanner() {
${jsPrintLines(variants.plainLines)}
}

function printBanner() {
  if ('NO_COLOR' in process.env || process.env.TERM === 'dumb') {
    printPlainBanner();
  } else if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') {
    printTruecolorBanner();
  } else if ((process.env.TERM || '').includes('256color')) {
    print256Banner();
  } else {
    print16Banner();
  }
}

printBanner();
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

function escapeDoubleQuoted(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\x1b', '\\x1b');
}

function pythonPrintLines(lines) {
  return lines.map((line) => `    print("${escapeDoubleQuoted(line)}")`).join('\n');
}

function goPrintLines(lines) {
  return lines.map((line) => `\tfmt.Println("${escapeDoubleQuoted(line)}")`).join('\n');
}

function rustPrintLines(lines) {
  return lines.map((line) => `\tprintln!("${escapeDoubleQuoted(line)}");`).join('\n');
}

function jsPrintLines(lines) {
  return lines.map((line) => `  console.log("${escapeDoubleQuoted(line)}")`).join('\n');
}
