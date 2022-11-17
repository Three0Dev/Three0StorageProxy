const express = require('express')
const {keyStores, KeyPair, transactions, connect} = require('near-api-js')
const web3Storage = require('web3.storage')
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const fileUpload = require('express-fileupload');
const cors = require('cors');
const morgan = require('morgan');

const app = express()
app.use(fileUpload());
  
app.use(cors());

app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

dotenv.config();

const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = process.env.NEAR_PRIVATE_KEY;
// creates a public / private key pair using the provided private key
const keyPair = KeyPair.fromString(PRIVATE_KEY);
// adds the keyPair you created to keyStore

const storage = new web3Storage.Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN })

const PORT = process.env.PORT || 8000

let account;
let near;

app.listen(PORT, async () => {
    await myKeyStore.setKey("testnet", "three0.testnet", keyPair);

    near = await connect({
        networkId: "testnet",
        keyStore: myKeyStore, // first create a key store 
        nodeUrl: "https://rpc.testnet.near.org",
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://explorer.testnet.near.org",
    });

    account = await near.account("three0.testnet");

    console.log(`Three0 Storage Proxy listening on port ${PORT}`)
})

app.get("/", (_req, res) => {
    res.redirect("https://three0dev.com")
})

app.post("/generateToken", async (req, res) => {
    // res.append('Access-Control-Allow-Origin', req.headers.origin);
    const newArgs = { account_to_validate: req.body.accountId, nonce: req.body.nonce };

    try{
        await account.signAndSendTransaction({
            receiverId: req.body.pid,
            actions: [
                transactions.functionCall(
                    "validate_nonce",
                    Buffer.from(JSON.stringify(newArgs)),
                    10000000000000,
                    "0"
                ),
            ],
        });

    } catch (error) {
        console.log(error);
        return res.status(500).send("Internal server error");
    }

    const token = jwt.sign(req.body, process.env.JWT_SECRET_KEY, { expiresIn: '1d' });
  
    // res.cookie('three0storage', token, {
    //     path: '/',
    //     sameSite: 'none',
    //     maxAge: 1000 * 60 * 60 * 24
    // }).send('Cookie is set');

    res.json({
        token
    })
});

const authMiddleware = (req, res, next) => {
    // const token = req.cookies.three0storage;
    // console.log(req.cookies)

    const authToken = req.headers.authorization;
    res.header('Access-Control-Allow-Origin', req.headers.origin); //req.headers.origin
    res.set('Access-Control-Allow-Credentials', 'true');

    let jwtSecretKey = process.env.JWT_SECRET_KEY;
  
    try {
        jwt.verify(authToken, jwtSecretKey);

        next();
    } catch (error) {
        // Access Denied
        return res.status(401).send(error);
    }
};

app.post('/upload',authMiddleware, async (req, res) => {
    console.log('uploading file...');

    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            const files = !Array.isArray(req.files.file) ? 
                [new web3Storage.File([req.files.file.data], req.files.file.name, { type: req.files.file.mimetype })]
                : req.files.file.map(file => new web3Storage.File([file.data], file.name, { type: file.mimetype }));

            const cid = await storage.put(files)
    
            res.json({
                status: true,
                cid
            });
        }
    } catch (err) {
        console.log(err)
        res.status(500).send(err);
    }
});


