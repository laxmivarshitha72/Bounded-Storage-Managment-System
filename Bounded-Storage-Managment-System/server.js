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

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Load data from Excel (or create new file if it doesn't exist)
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

// Generate unique component ID
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

// Generate unique file ID
function generateFileId(existingFiles) {
    const existingIds = existingFiles.map(file => {
        const match = file.id.match(/FILE-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
    
    const maxId = Math.max(0, ...existingIds);
    return `FILE-${(maxId + 1).toString().padStart(3, '0')}`;
}

// API Endpoints

// Regular user login
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

// Admin login endpoint
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

// Get pending requests for admin
app.get('/api/requests/pending', async (req, res) => {
    try {
        const data = await loadExcel();
        const pendingRequests = data.filter(item => 
            item.Status && item.Status.toLowerCase() === 'pending'
        );
        res.json(pendingRequests);
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        res.status(500).json({ error: "Failed to load pending requests" });
    }
});

// Issue components endpoint
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
        console.error("Error processing issue:", error);
        res.status(500).json({ error: "Failed to process component issue" });
    }
});

// Storage components endpoint
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
        console.error("Error processing storage:", error);
        res.status(500).json({ error: "Failed to process component storage" });
    }
});

// Approve request endpoint
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
        console.error("Error approving request:", error);
        res.status(500).json({ error: "Failed to approve request" });
    }
});

// Reject request endpoint
app.post('/api/requests/reject', async (req, res) => {
    try {
        const { requestId, rejectionReason } = req.body;
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
            "Status": "Rejected",
            "Rejection Reason": rejectionReason,
            "Rejected By": req.user?.name || "Admin",
            "Rejection Date": new Date().toISOString().split('T')[0]
        };
        
        currentData[requestIndex] = updatedRequest;
        
        const success = await saveToExcel(currentData);
        
        if (success) {
            res.json({ 
                success: true, 
                message: "Request rejected successfully",
                data: updatedRequest 
            });
        } else {
            res.status(500).json({ error: "Failed to save rejection" });
        }
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).json({ error: "Failed to reject request" });
    }
});

// Archive File Endpoints

// Get all archived files
app.get('/api/archive/files', async (req, res) => {
    try {
        await ensureUploadDir();
        const files = await readdir(UPLOAD_DIR);
        
        const fileDetails = await Promise.all(files.map(async (filename) => {
            const filePath = path.join(UPLOAD_DIR, filename);
            const stats = await fs.promises.stat(filePath);
            
            return {
                id: `FILE-${filename.split('-')[0]}`,
                name: filename,
                path: `/uploads/${filename}`,
                size: stats.size,
                uploadDate: stats.birthtime.toISOString(),
                description: filename.includes('_desc_') ? 
                    filename.split('_desc_')[1].split('.')[0].replace(/-/g, ' ') : 
                    'No description'
            };
        }));
        
        res.json(fileDetails);
    } catch (error) {
        console.error("Error fetching archived files:", error);
        res.status(500).json({ error: "Failed to load archived files" });
    }
});

// Upload file to archive
app.post('/api/archive/upload', async (req, res) => {
    try {
        await ensureUploadDir();
        
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        const file = req.files.file;
        const description = req.body.description || '';
        const sanitizedDescription = description.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const fileExt = path.extname(file.name);
        const fileNameBase = path.basename(file.name, fileExt);
        const timestamp = Date.now();
        
        const newFileName = `${timestamp}_${fileNameBase}_desc_${sanitizedDescription}${fileExt}`;
        const filePath = path.join(UPLOAD_DIR, newFileName);
        
        await file.mv(filePath);
        
        res.json({ 
            success: true, 
            message: "File uploaded successfully",
            filename: newFileName,
            path: `/uploads/${newFileName}`
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: "Failed to upload file" });
    }
});

// Delete file from archive
app.delete('/api/archive/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(UPLOAD_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }
        
        await unlink(filePath);
        res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// Rename file in archive
app.put('/api/archive/files/:filename', async (req, res) => {
    try {
        const oldFilename = req.params.filename;
        const newName = req.body.newName;
        
        if (!newName) {
            return res.status(400).json({ error: "New name is required" });
        }
        
        const oldPath = path.join(UPLOAD_DIR, oldFilename);
        const fileExt = path.extname(oldFilename);
        const newFilename = `${newName}${fileExt}`;
        const newPath = path.join(UPLOAD_DIR, newFilename);
        
        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: "File not found" });
        }
        
        await rename(oldPath, newPath);
        
        res.json({ 
            success: true, 
            message: "File renamed successfully",
            oldName: oldFilename,
            newName: newFilename
        });
    } catch (error) {
        console.error("Error renaming file:", error);
        res.status(500).json({ error: "Failed to rename file" });
    }
});

// Download file from archive
app.get('/api/archive/files/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(UPLOAD_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }
        
        res.download(filePath, filename);
    } catch (error) {
        console.error("Error downloading file:", error);
        res.status(500).json({ error: "Failed to download file" });
    }
});

// Create test data endpoint (for development)
app.post('/api/create-test-data', async (req, res) => {
    try {
        const testData = [
            {
                "Component ID": "CMP-TEST-001",
                "Name": "Test Component",
                "Type": "Issued Component",
                "Status": "Pending",
                "Date": new Date().toISOString().split('T')[0],
                "Issued To": "Test User",
                "Issue No": "TEST-001",
                "SO No": "SO-TEST-123"
            },
            {
                "Component ID": "CMP-TEST-002",
                "Name": "Test Storage",
                "Type": "Stored Component",
                "Status": "Pending",
                "Date": new Date().toISOString().split('T')[0],
                "Storage No": "STORE-001",
                "SO Number": "SO-TEST-456"
            }
        ];
        
        await saveToExcel(testData);
        res.json({ success: true, message: "Test data created" });
    } catch (error) {
        res.status(500).json({ error: "Failed to create test data" });
    }
});

// Initialize server
ensureUploadDir().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`API Endpoints:
  POST /api/login (regular user login)
  POST /api/admin/login (admin login)
  GET  /api/inventory
  GET  /api/requests/pending
  POST /api/issue
  POST /api/storage
  POST /api/requests/approve
  POST /api/requests/reject
  
  Archive Endpoints:
  GET    /api/archive/files
  POST   /api/archive/upload
  DELETE /api/archive/files/:filename
  PUT    /api/archive/files/:filename (rename)
  GET    /api/archive/files/download/:filename
  
  POST /api/create-test-data (development only)`);
    });
}).catch(err => {
    console.error("Failed to initialize upload directory:", err);
    process.exit(1);
});