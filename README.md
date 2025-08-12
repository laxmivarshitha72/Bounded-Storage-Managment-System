# Bounded-Storage-Managment-System

## Steps to Run and Use the Project

### 1. Start the Server

1. Open a terminal in the project folder.
2. Run: node server.js
3. This starts the backend server on **localhost:5500**.

> **Note:** This works without an internet connection.

---

### 2. Login as Admin

- Open `login_admin.html` in your browser.
- Both **Login** and **Sign Up** options are available on the same page.

**Admin (higher authorities) can:**
- View all incoming requests.
- Approve or reject component requests.

---

### 3. Login as User/Scientist

- Open `login_user.html` in your browser.

**Users/Scientists can:**
- Send requests to issue components.
- Store components in inventory.
- View all components.
- Move completed files to archive.

---

### 4. Admin Dashboard

- After a successful admin login, `admin_module.html` is displayed.
- The admin can see all pending requests and take appropriate action.

---

### 5. User Dashboard

- After a successful user login, `user_update.html` is displayed.
- The user can manage:
- Component requests.
- Storage.
- Archives.

---

### 6. Inventory Tracking

- All updates are stored in **Inventory.xlsx** in the project folder.
- This Excel sheet reflects real-time:
- Additions
- Issues
- Storage updates

---

## Conclusion

This system provides a **complete offline-compatible solution** for managing component requests, storage, and approvals within a controlled inventory environment.

- **Backend:** Node.js + Express  
- **Frontend:** HTML, CSS, JavaScript  
- **Data Tracking:** All changes are recorded in a central Excel file
- (**Inventory.xlsx**) for transparency and tracking.

