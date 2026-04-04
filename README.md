# 🌍 Smart-Fix & Recycle Uganda: Integrated ICT Lifecycle Portal

[![Deployment: Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Database: Neon PostgreSQL](https://img.shields.io/badge/Database-Neon_PostgreSQL-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![Framework: Tailwind_CSS](https://img.shields.io/badge/UI_Framework-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

A professional multi-page web platform engineered to solve Uganda's dual ICT challenge: **IT support congestion** and **e-waste mismanagement**. 

Built with a modern tech stack, this repository serves as a functional bridge between Ugandan citizens and the National E-Waste Management Centre.

---

## 🏗️ Project Architecture (Multi-Page)

To ensure efficient parallel development across our 7-member team, the project is structured into distinct functional modules:

### 📂 Core Directory Structure
* `index.html` — **The Portal Hub:** Features our "Glassmorphism" UI and Navigation Guide Modal.
* `support.html` — **Remote Triage:** Secure POST-method forms for digital IT troubleshooting.
* `recycle.html` — **Pickup Requester:** Google Maps API integration for precise GPS location pinning.
* `library.html` — **Self-Help Library:** Localized troubleshooting guides for Tecno, Infinix, and Samsung.
* `safety.html` — **Data Sanitization:** Technical article on secure hardware disposal.
* `impact.html` — **National Tracker:** Data visualization using Chart.js based on ITU (2022) data.
* `dashboard.html` — **User Profile:** Relational data display connected to Neon PostgreSQL.
* `about.html` — **Meet the Team:** Professional bios and role allocations for the 7 project engineers.

---

## 🛠️ Technical Stack
* **Frontend:** HTML5 (Semantic), Tailwind CSS (Utility-first), JavaScript (ES6+).
* **Database:** Neon PostgreSQL (Serverless SQL).
* **Hosting:** Vercel (CI/CD integration with GitHub).
* **Visualization:** Chart.js (Canvas-based rendering).
* **Security:** Bcrypt hashing for credentials; POST method for sensitive data transmission.

---

## 🤝 GitHub Workflow for the Team
To maintain code integrity with 7 contributors, we follow these protocols:

1.  **Branching Strategy:** No direct commits to `main`. Every member works on a specific feature branch (e.g., `feature/support-page`).
2.  **Pull Requests:** Code is reviewed by at least one other member before merging to the stable `main` branch.
3.  **Issue Tracking:** We utilize **GitHub Issues** to assign specific pages and technical tasks to team members.
4.  **Environment Safety:** Sensitive keys (API keys/DB strings) are stored in a `.env` file and ignored via `.gitignore`.

---

## 🚀 Deployment
The site is automatically built and deployed via **Vercel** upon every merge to the `main` branch. 

**Live URL:** [Insert your Vercel URL here after deployment]

---
*Created for the 2026 Internet Technology Project | Kampala, Uganda*


