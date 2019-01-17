#!/usr/bin/env node
'use strict';

import path from 'path';
import chalk from 'chalk';
import gaze from 'gaze';
import globby from 'globby';
import meow from 'meow';
import sass from 'node-sass';
import temp from 'temp';

import Converter from './converter';
import { writeFile, readFile } from './fs';

const cli = meow(
  {
    description: 'Creates .flow type definition files from CSS Modules files',
    help: `
Usage
  $ css-modules-flow-types <path> [<path>] [options]

path    directory to search for CSS Modules (or concrete files to convert)

Options
  --watch, -w       Run in watch mode
  --extension, -e   File extension (defaults to "css")
  --silent, -s      Silences all output except errors
    `,
  },
  {
    boolean: ['watch', 'silent'],
    string: ['_'],
    alias: {
      e: 'extension',
      h: 'help',
      w: 'watch',
      s: 'silent',
    },
  }
);

function detectDanlingFlowFiles(filesPattern, cssFiles) {
  const flowFiles = globby.sync(filesPattern + '.flow');
  const cssFilesSet = new Set(cssFiles);
  const danglingFlowFiles = flowFiles.filter(
    f => !cssFilesSet.has(f.replace('.flow', ''))
  );

  if (danglingFlowFiles.length > 0) {
    console.error(
      chalk.red(
        `Detected ${danglingFlowFiles.length} dangling .flow file(s), that can be removed:`
      )
    );
    danglingFlowFiles.forEach(f => {
      console.error(chalk.red(`- ${f}`));
    });
  }
}

const main = () => {
  const { watch, silent } = cli.flags;

  if (!cli.input || cli.input.length === 0) {
    return cli.showHelp();
  }

  const extension = cli.flags.extension || 'css';

  const filesList = cli.input.length > 1 ? cli.input : null;
  const filePath = cli.input.length === 1 ? cli.input[0] : null;
  const filesPattern = filePath && path.join(filePath, `**/*.${extension}`);

  const rootDir = process.cwd();
  const converter = new Converter(rootDir);

  async function handleFile(scssFilePath) {
    try {
      scssFilePath = path.resolve(scssFilePath);

      const cssContents = (await renderSass({
        file: scssFilePath,
      })).css.toString();

      const tempCssFile = temp.path({ suffix: '.css' });
      await writeFile(tempCssFile, cssContents, 'utf8');

      const flowTypings = await converter.convert(tempCssFile);
      const flowTypingsFile = path.join(scssFilePath + '.flow');
      await writeFile(flowTypingsFile, flowTypings, 'utf8');

      if (!silent) {
        let outputFileRelative = path.relative(process.cwd(), flowTypingsFile);
        if (!outputFileRelative.startsWith('../')) {
          outputFileRelative = `./${outputFileRelative}`;
        }

        console.info(chalk.green('[Wrote] ' + outputFileRelative));
      }
    } catch (reason) {
      console.error(chalk.red('[Error] ' + reason));
    }
  }

  if (!watch) {
    const cssFiles = filesList ? filesList : globby.sync(filesPattern);
    cssFiles.forEach(handleFile);

    if (!filesList) {
      detectDanlingFlowFiles(filesPattern, cssFiles);
    }
  } else {
    if (!filePath) {
      console.error(
        chalk.red(`Watch mode requires a single path... Not ${filesList}`)
      );
      return;
    }
    gaze(filesPattern, function(err, files) {
      this.on('changed', handleFile);
      this.on('added', handleFile);
    });
  }
};

function renderSass(opts) {
  return new Promise((resolve, reject) => {
    return sass.render(opts, (err, val) => {
      if (err) {
        return void reject(err);
      }

      resolve(val);
    });
  });
}

main();
