import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
copyFileSync('public/index.html','dist/index.html');
copyFileSync('public/styles.css','dist/styles.css');
console.log('Created standalone static site in dist/.');
