const CACHE = 'work-progress-desk-v39-department-plan-contract';
const ASSETS = ['./', './index.html', './styles.css', './activity-ui-v2.css', './activity-center.js', './activity-task-adapter.js', './hospital-master.js', './hospital-identity.js', './department-identity.js', './deletion-policy.js', './hospital-maintenance-adapter.js', './customer-profile/customer-profile.css', './customer-profile/customer-profile.js', './task-progress-adapter.js', './task-progress-v2.js', './public-runtime-config.js', './cloud-config.js', './cloud-sync.js', './directory-data.js', './workspace-navigation.js', './vendor/xlsx.full.min.js', './vendor/crypto-js.js', './vendor/xlsx-populate.min.js', './vendor/pptxgen.bundle.js', './vendor/tesseract/tesseract.min.js', './product-registry.js', './reporting.js', './quarterly-ppt.js', './smart-sheet-adapter.js', './customer-upgrade-adapter.js', './excel-local-reader.js', './sales-import-adapter.js', './four-three-plan-adapter.js', './dashboard-v2.js', './shared-persistence.js', './app.js', './manifest.webmanifest', './icon.svg', './data/sales-24.10-26.6-sheet1.json'];
ASSETS.push('./activity-template-assets.js', './assets/activity-templates/academic-request.docx', './assets/activity-templates/department-meeting.xlsx');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
