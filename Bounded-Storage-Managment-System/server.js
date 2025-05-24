const express = require('express');
const fileUpload = require('express-fileupload');
const xlsx = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const PORT = 3000;
const EXCEL_FILE = 'inventory.xlsx';

// Load data from Excel (or create new file if it doesn't exist)
async function loadExcel() {
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            const defaultData = [
                {
                    "Component ID": "CMP-001",
                    "Name": "Electrical Module",
                    "Type": "EM",
                    "Status": "In Stock",
                    "Date": new Date().toISOString().split('T')[0],
                    "Issued To": ""
                },
                {
                    "Component ID": "CMP-002",
                    "Name": "Frequency Modulator",
                    "Type": "FM",
                    "Status": "Issued",
                    "Date": new Date().toISOString().split('T')[0],
                    "Issued To": "John Doe"
                }
            ];
            const newWB = xlsx.utils.book_new();
            const newWS = xlsx.utils.json_to_sheet(defaultData);
            xlsx.utils.book_append_sheet(newWB, newWS, "Inventory");
            await writeFile(EXCEL_FILE, xlsx.write(newWB, { type: 'buffer' }));
            return defaultData;
        }

        const buffer = await readFile(EXCEL_FILE);
        const wb = xlsx.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws);
        
        // Filter out any empty rows
        return data.filter(item => item['Component ID'] && item['Component ID'].trim() !== '');
    } catch (error) {
        console.error("Error loading Excel:", error);
        return [];
    }
}

// Save data to Excel
async function saveToExcel(data) {
    try {
        const newWB = xlsx.utils.book_new();
        const newWS = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(newWB, newWS, "Inventory");
        await writeFile(EXCEL_FILE, xlsx.write(newWB, { type: 'buffer' }));
        return true;
    } catch (error) {
        console.error("Error saving Excel:", error);
        return false;
    }
}

// API Endpoints
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }
    res.json({ 
        success: true, 
        user: { 
            name: username,
            token: 'demo-token-' + Math.random().toString(36).substr(2)
        } 
    });
});

// Get inventory data
app.get('/api/inventory', async (req, res) => {
    try {
        const data = await loadExcel();
        res.setHeader('Cache-Control', 'no-store');
        res.json(data);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

// Add new item to inventory
app.post('/api/inventory', async (req, res) => {
    try {
        const currentData = await loadExcel();
        const newItem = {
            "Component ID": `CMP-${(currentData.length + 1).toString().padStart(3, '0')}`,
            "Name": req.body.name || "New Component",
            "Type": req.body.type || "EM",
            "Status": req.body.status || "In Stock",
            "Date": new Date().toISOString().split('T')[0],
            "Issued To": req.body.issuedTo || ""
        };

        const updatedData = [...currentData, newItem];
        const success = await saveToExcel(updatedData);
        
        if (success) {
            res.json(updatedData);
        } else {
            res.status(500).json({ error: "Failed to save data" });
        }
    } catch (error) {
        console.error("Error adding item:", error);
        res.status(500).json({ error: "Failed to add item" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Endpoints:
  POST /api/login
  GET  /api/inventory
  POST /api/inventory`);
});