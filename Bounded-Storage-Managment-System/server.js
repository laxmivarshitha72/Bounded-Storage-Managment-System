const express = require('express');
const fileUpload = require('express-fileupload');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const PORT = 3000;
const EXCEL_FILE = 'inventory.xlsx';

// Load or create Excel file
function loadExcel() {
    try {
        return xlsx.readFile(EXCEL_FILE);
    } catch (e) {
        // Create new file if it doesn't exist
        const newWB = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWB, xlsx.utils.json_to_sheet([]), "Inventory");
        xlsx.writeFile(newWB, EXCEL_FILE);
        return newWB;
    }
}

// API Endpoints
app.post('/api/login', (req, res) => {
    // Implement your authentication logic
    res.json({ success: true, user: { name: req.body.username } });
});

app.get('/api/inventory', (req, res) => {
    const wb = loadExcel();
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws);
    res.json(data);
});

app.post('/api/inventory', (req, res) => {
    const wb = loadExcel();
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws);
    
    // Add new item
    data.push(req.body);
    
    // Write back to Excel
    const newWS = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, newWS, "Inventory");
    xlsx.writeFile(wb, EXCEL_FILE);
    
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});