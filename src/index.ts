import express, { Request, Response, NextFunction } from 'express';
import { Client, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY; // Clave de seguridad

// 1. Middleware de Seguridad
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-api-key'];
    if (key !== API_KEY) {
        res.status(403).json({ error: 'Unauthorized: Invalid API Key' });
        return;
    }
    next();
};

// 2. Inicialización de WhatsApp con Persistencia
let client: Client;

const initializeWhatsapp = async () => {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✅ Conectado a MongoDB');

    const store = new MongoStore({ mongoose: mongoose });

    client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000 // Guardar sesión cada minuto si hay cambios
        }),
        puppeteer: {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Vital para Docker
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-software-rasterizer',
                '--mute-audio', // Ahorra memoria de buffers de audio
                '--disable-features=site-per-process', // Ahorra mucha RAM, pero menos seguro (ok para un bot propio)
                '--single-process' // Forzar todo en un solo proceso (Riesgoso en Windows, OK en Linux Docker limitado)
            ],
            headless: true
        }
    });

    client.on('qr', (qr) => {
        // Esto imprimirá el QR en los logs de Render para que lo escanees
        console.log('⚠️ ESCANEA ESTE QR EN LOS LOGS DE RENDER:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('🚀 WhatsApp Client is ready!');
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sesión guardada en Mongo');
    });

    await client.initialize();
};

initializeWhatsapp();

// 3. Endpoint de envío (Protegido)
app.post('/send', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { number, message } = req.body;

    if (!client) {
        res.status(503).json({ error: 'Client not ready yet' });
        return;
    }

    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ status: 'sent', to: number });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Health check para Render (para que sepa que estamos vivos)
app.get('/health', (req, res) => res.send('OK'));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});