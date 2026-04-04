require('dotenv').config({ path: '.env.local' });
const https = require('https');

function checkSecret() {
    console.log("Verifying Auth0 Client ID and Secret (Native HTTPS)...");
    const domain = process.env.AUTH0_DOMAIN;
    const path = '/oauth/token';
    
    const body = new URLSearchParams({
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        grant_type: 'client_credentials',
        audience: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`
    }).toString();

    const options = {
        hostname: domain,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body.length
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const result = JSON.parse(data);
            console.log("Status:", res.statusCode);
            
            if (res.statusCode === 401) {
                console.error("❌ EL SECRET ES INVALIDO (Unauthorized)");
                process.exit(1);
            } else if (res.statusCode === 403) {
                console.log("✅ SECRET VALIDO, pero falta grant para la API (Expected for this test)");
                console.log("Mensaje de Auth0:", result.error_description);
            } else if (res.statusCode === 200) {
                console.log("🚀 SECRET VALIDO Y TOKEN GENERADO!");
            } else {
                console.log("Respuesta inesperada:", result);
            }
        });
    });

    req.on('error', (e) => {
        console.error("Fetch error:", e.message);
    });

    req.write(body);
    req.end();
}
checkSecret();
