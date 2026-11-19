import {defineConfig} from 'vite'
import {readdirSync,cpSync} from 'node:fs'
export default defineConfig({build:{rollupOptions:{input:['index.html',...readdirSync('work').map(slug=>'work/'+slug+'/index.html')]}},plugins:[{name:'portfolio-assets',closeBundle(){cpSync('assets','dist/assets',{recursive:true});for(const file of ['robots.txt','sitemap.xml'])cpSync(file,'dist/'+file)}}]})