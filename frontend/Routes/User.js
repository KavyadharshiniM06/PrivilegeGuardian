const User = require('../Models/User.js');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const Report = require('../Models/Report.js');
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt - Request body:', req.body);
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('Missing credentials - username:', username, 'password:', password);
            return res.status(400).json({ message: "Please enter all fields" });
        }

        const userfind = await User.findOne({ username });
        if (!userfind) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, userfind.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { id: userfind._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: userfind._id,
                username: userfind.username,
                role: userfind.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});



router.post('/register', async (req, res) => {
    try {
        const { username, password,role } = req.body;

        if (!username || !password||!role) {
            return res.status(400).json({ message: "Please enter all fields" });
        }

        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashpassword = await bcrypt.hash(password, 10);

        const newuser = new User({
            username,
            password: hashpassword,
            role:role
        });

        await newuser.save();

        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/adduser', async (req, res) => {
    try {
        const { username, password,role } = req.body;
            if (!username || !password||!role) {
                return res.status(400).json({ message: "Please enter all fields" });
            }   
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }       
        const hashpassword = await bcrypt.hash(password, 10);

        const newuser = new User({  
            username,
            password: hashpassword,
            role:role
        });     
        await newuser.save();

        res.status(201).json({ message: "User added successfully" });
    }
        catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    }
    catch(err)
    {
        res.status(500).json({ error: err.message });   
    }
});
router.post('/generate', async (req, res) => {
    try {
        const { reportName, generatedBy, date, reportType, status } = req.body;
        console.log('Request body:', req.body);

        if (!reportName || !generatedBy || !date || !reportType || !status) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newReport = new Report({
            report: reportName,
            generatedBy,
            date: new Date(date),  
            format: reportType,
            status
        });

        console.log('Report to save:', newReport);
        await newReport.save();

        res.status(201).json({ message: "Report generated successfully" });

    } catch (err) {
        console.error('Error in /generate:', err);  
        res.status(500).json({ error: err.message });
    }
});
router.get('/reports', async (req, res) => {
    try {
        const reports = await Report.find();
        console.log('Reports found:', reports);
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedReport = await Report.findByIdAndDelete(id);
        
        if (!deletedReport) {
            return res.status(404).json({ message: "Report not found" });
        }
        
        console.log('Report deleted:', id);
        res.status(200).json({ message: "Report deleted successfully" });
    } catch (err) {
        console.error('Error deleting report:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/reports/delete/all', async (req, res) => {
    try {
        const result = await Report.deleteMany({});
        console.log('All reports deleted. Deleted count:', result.deletedCount);
        res.status(200).json({ message: "All reports deleted successfully", deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Error deleting all reports:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
