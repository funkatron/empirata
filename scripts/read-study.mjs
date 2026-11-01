import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
/** Historical run records are compressed; freshly reproduced records are plain JSON. */
export function readStudy(path){return JSON.parse(existsSync(path)?readFileSync(path,'utf8'):gunzipSync(readFileSync(path+'.gz')).toString('utf8'));}
