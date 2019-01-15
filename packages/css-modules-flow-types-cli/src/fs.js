'use strict';

import fs from 'fs';

export function writeFile(outputFilePath, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(outputFilePath, content, 'utf8', err => {
      if (err) {
        reject(err);
      } else {
        resolve(outputFilePath);
      }
    });
  });
}

export function readFile(inputFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
