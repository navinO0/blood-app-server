const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
const fs = require('fs');
fs.writeFileSync('vapid.json', JSON.stringify(vapidKeys, null, 2));
console.log('Keys written to vapid.json');
