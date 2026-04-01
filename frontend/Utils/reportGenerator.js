/**
 * Report Generator
 * 
 * Produces downloadable reports:
 *   - summary_pdf    : Executive summary PDF with key metrics
 *   - events_csv     : All events as CSV
 *   - alerts_csv     : All alerts as CSV
 *   - user_risk_csv  : Per-user risk breakdown CSV
 */

const PDFDocument = require('pdfkit');
const { createWriteStream } = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

/**
 * Generate Summary PDF Report
 * @param {Object} data - Report data with stats, top_users, recent_alerts
 * @param {string} outputPath - Path to save PDF file
 * @returns {Promise<string>} Path to generated PDF
 */
async function generateSummaryPDF(data, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const stream = createWriteStream(outputPath);
            doc.pipe(stream);

            // Title
            doc.fontSize(24).font('Helvetica-Bold').text('PrivilegeGuardian', { align: 'center' });
            doc.fontSize(11).font('Helvetica').text(
                `Security Audit Report • Generated ${new Date().toLocaleString()}`,
                { align: 'center', fill: '#666699' }
            );
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccccdd');
            doc.moveDown();

            // Executive Summary
            doc.fontSize(14).font('Helvetica-Bold').text('Executive Summary', { underline: true });
            doc.moveDown(0.5);

            const stats = data.stats || {};
            const summaryData = [
                { metric: 'Total Events Monitored', value: stats.total_events || 0 },
                { metric: 'Total Alerts Generated', value: stats.total_alerts || 0 },
                { metric: 'Critical Alerts', value: stats.critical_alerts || 0 },
                { metric: 'High Alerts', value: stats.high_alerts || 0 },
                { metric: 'Denied Access Events', value: stats.denied_events || 0 },
                { metric: 'Unique Users Monitored', value: stats.unique_users || 0 },
                { metric: 'Report Period', value: stats.period || 'All time' },
            ];

            doc.fontSize(10).font('Helvetica');
            summaryData.forEach((item) => {
                doc.text(`${item.metric}: ${item.value}`);
            });
            doc.moveDown();

            // Top Users
            if (data.top_users && data.top_users.length > 0) {
                doc.fontSize(14).font('Helvetica-Bold').text('Top Users by Risk Score', { underline: true });
                doc.moveDown(0.5);
                
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Username', 50, doc.y, { width: 100, align: 'left' });
                doc.text('Events', 150, doc.y, { width: 60, align: 'center' });
                doc.text('Avg Risk', 210, doc.y, { width: 60, align: 'center' });
                doc.text('Max Risk', 270, doc.y, { width: 60, align: 'center' });
                doc.text('Alerts', 330, doc.y, { width: 60, align: 'center' });
                doc.moveDown();

                doc.fontSize(8).font('Helvetica');
                data.top_users.slice(0, 10).forEach((user) => {
                    doc.text(user.username || 'N/A', 50, doc.y, { width: 100, align: 'left' });
                    doc.text(String(user.total_events || 0), 150, doc.y, { width: 60, align: 'center' });
                    doc.text((user.avg_risk || 0).toFixed(1), 210, doc.y, { width: 60, align: 'center' });
                    doc.text((user.max_risk || 0).toFixed(1), 270, doc.y, { width: 60, align: 'center' });
                    doc.text(String(user.alert_count || 0), 330, doc.y, { width: 60, align: 'center' });
                    doc.moveDown();
                });
                doc.moveDown();
            }

            // Recent Alerts
            if (data.recent_alerts && data.recent_alerts.length > 0) {
                doc.fontSize(14).font('Helvetica-Bold').text('Recent Critical & High Alerts', { underline: true });
                doc.moveDown(0.5);

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Time', 50, doc.y, { width: 80, align: 'left' });
                doc.text('User', 130, doc.y, { width: 70, align: 'left' });
                doc.text('Severity', 200, doc.y, { width: 70, align: 'left' });
                doc.text('Action', 270, doc.y, { width: 80, align: 'left' });
                doc.moveDown();

                doc.fontSize(8).font('Helvetica');
                data.recent_alerts.slice(0, 15).forEach((alert) => {
                    const time = alert.created_at ? alert.created_at.substring(0, 16) : 'N/A';
                    doc.text(time, 50, doc.y, { width: 80, align: 'left' });
                    doc.text(alert.username || 'N/A', 130, doc.y, { width: 70, align: 'left' });
                    doc.text(alert.severity || 'N/A', 200, doc.y, { width: 70, align: 'left' });
                    doc.text((alert.action || 'N/A').substring(0, 20), 270, doc.y, { width: 80, align: 'left' });
                    doc.moveDown();
                });
            }

            // Footer
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccccdd');
            doc.fontSize(8).font('Helvetica').text(
                'PrivilegeGuardian — Confidential Security Report. Not for distribution outside the security team.',
                { align: 'center', fill: '#999999' }
            );

            doc.end();

            stream.on('finish', () => {
                resolve(outputPath);
            });

            stream.on('error', reject);

        } catch (err) {
            reject(err);
        }
    });
}


/**
 * Generate CSV from array of objects
 * @param {Array} data - Array of objects
 * @returns {string} CSV content
 */
function generateCSV(data) {
    if (!data || data.length === 0) {
        return 'No data available';
    }

    try {
        const parser = new Parser();
        return parser.parse(data);
    } catch (err) {
        console.error('Error generating CSV:', err);
        return 'Error generating CSV: ' + err.message;
    }
}


/**
 * Generate Events CSV Report
 * @param {Array} events - Array of event objects
 * @returns {string} CSV content
 */
function generateEventsCSV(events) {
    return generateCSV(events);
}


/**
 * Generate Alerts CSV Report
 * @param {Array} alerts - Array of alert objects
 * @returns {string} CSV content
 */
function generateAlertsCSV(alerts) {
    return generateCSV(alerts);
}


/**
 * Generate User Risk CSV Report
 * @param {Array} users - Array of user objects with risk data
 * @returns {string} CSV content
 */
function generateUserRiskCSV(users) {
    return generateCSV(users);
}


module.exports = {
    generateSummaryPDF,
    generateEventsCSV,
    generateAlertsCSV,
    generateUserRiskCSV,
};
