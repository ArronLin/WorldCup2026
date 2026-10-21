import {defineConfig} from 'vite';
export default defineConfig({test:{include:['probe.spec.js'],coverage:{provider:'v8',include:['src/**/*.js'],reporter:['json','lcov'],reportsDirectory:'coverage'}}});
