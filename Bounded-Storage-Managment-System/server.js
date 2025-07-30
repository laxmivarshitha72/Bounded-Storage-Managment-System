const express = require('express');
const fileUpload = require('express-fileupload');
const xlsx = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const rename = promisify(fs.rename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static('uploads'));

const PORT = 3000;
const EXCEL_FILE = 'inventory.xlsx';
const UPLOAD_DIR = 'uploads';

async function ensureUploadDir() {
    try {
        await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function loadExcel() {
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            const defaultData = [
                {
                    "Component ID": "CMP-001",
                    "Name": "Electrical Module",
                    "Type": "EM",
                    "Status": "Pending",
                    "Date": new Date().toISOString().split('T')[0],
                    "Issued To": "John Doe",
                    "Issue No": "ISS-001",
                    "SO No": "SO-001",
                    "Issue Date": new Date().toISOString().split('T')[0]
                },
                {
                    "Component ID": "CMP-002",
                    "Name": "Frequency Modulator",
                    "Type": "FM",
                    "Status": "Pending",
                    "Date": new Date().toISOString().split('T')[0],
                    "Storage No": "STO-001",
                    "SO Number": "SO-002",
                    "Storage Date": new Date().toISOString().split('T')[0]
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

        return data.filter(item =>
            (item['Component ID'] && item['Component ID'].trim() !== '') ||
            (item['Part No'] && item['Part No'].trim() !== '')
        );
    } catch (error) {
        console.error("Error loading Excel:", error);
        return [];
    }
}

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

function generateComponentId(existingData) {
    const existingIds = existingData
        .filter(item => item['Component ID'])
        .map(item => {
            const match = item['Component ID'].match(/CMP-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        });

    const maxId = Math.max(0, ...existingIds);
    return `CMP-${(maxId + 1).toString().padStart(3, '0')}`;
}

function generateFileId(existingFiles) {
    const existingIds = existingFiles.map(file => {
        const match = file.id.match(/FILE-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });

    const maxId = Math.max(0, ...existingIds);
    return `FILE-${(maxId + 1).toString().padStart(3, '0')}`;
}

// ------------------------ API Endpoints ----------------------------

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

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }
    res.json({
        success: true,
        user: {
            name: username,
            role: 'admin',
            token: 'admin-token-' + Math.random().toString(36).substr(2)
        }
    });
});

app.get('/api/inventory', async (req, res) => {
    try {
        const data = await loadExcel();
        res.setHeader('Cache-Control', 'no-store');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

app.get('/api/requests/pending', async (req, res) => {
    try {
        const data = await loadExcel();
        const pendingRequests = data.filter(item =>
            item.Status && item.Status.toLowerCase() === 'pending'
        );
        res.json(pendingRequests);
    } catch (error) {
        res.status(500).json({ error: "Failed to load pending requests" });
    }
});

app.post('/api/issue', async (req, res) => {
    try {
        const currentData = await loadExcel();
        const { issueNo, issueDate, requestText, issueTo, issueFor, systemManager, components } = req.body;

        if (!issueNo || !issueDate || !issueTo || !components || components.length === 0) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newItems = [];

        for (const component of components) {
            const newItem = {
                "Component ID": generateComponentId([...currentData, ...newItems]),
                "Name": component.partDescription || "Issued Component",
                "Part No": component.partNo,
                "Part Description": component.partDescription,
                "Type": "Issued Component",
                "Status": "Pending",
                "Date": new Date().toISOString().split('T')[0],
                "Issued To": issueTo,
                "Issue No": issueNo,
                "Issue Date": component.issueDate || issueDate,
                "Request Text": requestText,
                "Issue For": issueFor,
                "System Manager": systemManager,
                "Serial No": component.serialNo,
                "S.No as per SO": component.snoSO,
                "Manufacturer": component.manufacturer,
                "Quality Grade": component.qualityGrade,
                "Sub System": component.subSystem,
                "Quantity Each": component.quantityEach,
                "Total Quantity": component.totalQuantity,
                "SO No": component.soNo
            };
            newItems.push(newItem);
        }

        const updatedData = [...currentData, ...newItems];
        const success = await saveToExcel(updatedData);

        if (success) {
            res.json({
                success: true,
                message: `Successfully submitted ${components.length} components for approval`,
                data: updatedData
            });
        } else {
            res.status(500).json({ error: "Failed to save issue data" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to process component issue" });
    }
});

app.post('/api/storage', async (req, res) => {
    try {
        const currentData = await loadExcel();
        const { storageNo, storageDate, soNumber, systemManager, components } = req.body;

        if (!storageNo || !storageDate || !soNumber || !components || components.length === 0) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newItems = [];

        for (const component of components) {
            const newItem = {
                "Component ID": generateComponentId([...currentData, ...newItems]),
                "Name": component.partDescription || "Stored Component",
                "Part No": component.partNo,
                "Part Description": component.partDescription,
                "Type": "Stored Component",
                "Status": "Pending",
                "Date": new Date().toISOString().split('T')[0],
                "Storage No": storageNo,
                "Storage Date": storageDate,
                "SO Number": soNumber,
                "System Manager": systemManager,
                "Serial No": component.serialNo,
                "S.No as per PO": component.snoPO,
                "Grade": component.grade,
                "Storage Quantity": component.quantity,
                "Storage Temperature": component.storageTemp,
                "Relative Humidity": component.relativeHumidity,
                "Storage Data": component.storageData,
                "Delivery Date": component.deliveryDate,
                "SO No": soNumber
            };
            newItems.push(newItem);
        }

        const updatedData = [...currentData, ...newItems];
        const success = await saveToExcel(updatedData);

        if (success) {
            res.json({
                success: true,
                message: `Successfully submitted ${components.length} components for storage approval`,
                data: updatedData
            });
        } else {
            res.status(500).json({ error: "Failed to save storage data" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to process component storage" });
    }
});

app.post('/api/requests/approve', async (req, res) => {
    try {
        const { requestId, approvalData } = req.body;
        const currentData = await loadExcel();

        const requestIndex = currentData.findIndex(item =>
            item['Component ID'] === requestId ||
            item['Issue No'] === requestId ||
            item['Storage No'] === requestId
        );

        if (requestIndex === -1) {
            return res.status(404).json({ error: "Request not found" });
        }

        const updatedRequest = {
            ...currentData[requestIndex],
            "Status": "Approved",
            "Approved By": approvalData.approvedBy,
            "Approval Date": new Date().toISOString().split('T')[0],
            "Approval Signature": approvalData.signature
        };

        currentData[requestIndex] = updatedRequest;

        const success = await saveToExcel(currentData);

        if (success) {
            res.json({
                success: true,
                message: "Request approved successfully",
                data: updatedRequest
            });
        } else {
            res.status(500).json({ error: "Failed to save approval" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to approve request" });
    }
});

// ⏳ (Due to length limits, I’ll continue the rest — archive, reject, upload, rename, etc. — in the next message. Shall I continue?)
