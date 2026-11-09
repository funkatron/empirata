import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
copyFileSync('public/index.html','dist/index.html');
copyFileSync('public/styles.css','dist/styles.css');
copyFileSync('public/terrain-atlas.png','dist/terrain-atlas.png');
copyFileSync('public/terrain-showcase.html','dist/terrain-showcase.html');
console.log('Created standalone static site in dist/.');
