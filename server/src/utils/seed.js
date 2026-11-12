import "dotenv/config";
import { prisma } from "../config/db.js";
import { nextSequence } from "./counter.js";
import { hashPassword } from "./userHelpers.js";

// One demo login per role so every scope described in the brief (super admin,
// receptionist, doctor, pharmacist, lab/radiology, accounts, inventory,
// nursing) can be signed into and checked immediately after setup, without
// anyone having to hand-create nine accounts first. Passwords follow the
// same "Role@123" pattern as the original demo doctor account — change all
// of these before using the system with real patient data.
const DEMO_USERS = [
  { username: "admin", role: "super_admin", name: "System Administrator", designation: "Super Admin", department: "Administration" },
  { username: "manager", role: "admin", name: "Clinic Manager", designation: "Administrator", department: "Administration" },
  { username: "reception", role: "receptionist", name: "Front Desk", designation: "Receptionist", department: "Reception" },
  { username: "doctor", role: "doctor", name: "Dr. Demo Doctor", designation: "General Physician", department: "OPD" },
  { username: "nurse", role: "nurse", name: "Staff Nurse", designation: "Nurse", department: "OPD" },
  { username: "pharmacist", role: "pharmacist", name: "Chief Pharmacist", designation: "Pharmacist", department: "Pharmacy" },
  { username: "labtech", role: "lab_tech", name: "Lab Technician", designation: "Lab Technician", department: "Laboratory" },
  { username: "radiologist", role: "radiologist", name: "Duty Radiologist", designation: "Radiologist", department: "Radiology" },
  { username: "accountant", role: "accountant", name: "Accounts Officer", designation: "Accountant", department: "Finance" },
  { username: "storekeeper", role: "inventory_manager", name: "Store Keeper", designation: "Inventory Manager", department: "Stores" },
];

const roleLabel = (role) => role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const passwordFor = (username) => `${username.charAt(0).toUpperCase()}${username.slice(1)}@123`;

const LAB_CATALOG = [
  { name: "Complete Blood Count (CBC)", category: "Hematology", price: 250, normalRange: "Per lab reference", sampleType: "Whole blood" },
  { name: "Hemoglobin (Hb)", category: "Hematology", price: 120, normalRange: "Male 13.5-17.5, Female 12-15.5", unit: "g/dL", sampleType: "Whole blood" },
  { name: "ESR", category: "Hematology", price: 120, normalRange: "0-20", unit: "mm/hr", sampleType: "Whole blood" },
  { name: "Platelet Count", category: "Hematology", price: 150, normalRange: "150-450", unit: "10^3/uL", sampleType: "Whole blood" },
  { name: "Blood Group and Rh", category: "Hematology", price: 150, sampleType: "Whole blood" },
  { name: "Fasting Blood Sugar", category: "Biochemistry", price: 100, normalRange: "70-100", unit: "mg/dL", sampleType: "Blood" },
  { name: "Random Blood Sugar", category: "Biochemistry", price: 100, normalRange: "70-140", unit: "mg/dL", sampleType: "Blood" },
  { name: "HbA1c", category: "Biochemistry", price: 450, normalRange: "< 5.7", unit: "%", sampleType: "Blood" },
  { name: "Urea", category: "Biochemistry", price: 180, normalRange: "15-40", unit: "mg/dL", sampleType: "Serum" },
  { name: "Creatinine", category: "Biochemistry", price: 180, normalRange: "0.6-1.3", unit: "mg/dL", sampleType: "Serum" },
  { name: "Uric Acid", category: "Biochemistry", price: 200, normalRange: "3.5-7.2", unit: "mg/dL", sampleType: "Serum" },
  { name: "Total Cholesterol", category: "Biochemistry", price: 220, normalRange: "< 200", unit: "mg/dL", sampleType: "Serum" },
  { name: "Triglycerides", category: "Biochemistry", price: 220, normalRange: "< 150", unit: "mg/dL", sampleType: "Serum" },
  { name: "HDL Cholesterol", category: "Biochemistry", price: 220, normalRange: "> 40", unit: "mg/dL", sampleType: "Serum" },
  { name: "LDL Cholesterol", category: "Biochemistry", price: 220, normalRange: "< 100", unit: "mg/dL", sampleType: "Serum" },
  { name: "Lipid Profile", category: "Biochemistry", price: 600, normalRange: "Per lab reference", sampleType: "Serum" },
  { name: "ALT (SGPT)", category: "Biochemistry", price: 200, normalRange: "7-56", unit: "U/L", sampleType: "Serum" },
  { name: "AST (SGOT)", category: "Biochemistry", price: 200, normalRange: "10-40", unit: "U/L", sampleType: "Serum" },
  { name: "Alkaline Phosphatase", category: "Biochemistry", price: 220, normalRange: "44-147", unit: "U/L", sampleType: "Serum" },
  { name: "Total Bilirubin", category: "Biochemistry", price: 200, normalRange: "0.1-1.2", unit: "mg/dL", sampleType: "Serum" },
  { name: "Liver Function Test (LFT)", category: "Biochemistry", price: 800, normalRange: "Per lab reference", sampleType: "Serum" },
  { name: "Sodium", category: "Electrolytes", price: 180, normalRange: "135-145", unit: "mmol/L", sampleType: "Serum" },
  { name: "Potassium", category: "Electrolytes", price: 180, normalRange: "3.5-5.1", unit: "mmol/L", sampleType: "Serum" },
  { name: "Calcium", category: "Electrolytes", price: 200, normalRange: "8.5-10.5", unit: "mg/dL", sampleType: "Serum" },
  { name: "Urine Routine Examination", category: "Urinalysis", price: 150, normalRange: "Per lab reference", sampleType: "Urine" },
  { name: "Stool Routine Examination", category: "Parasitology", price: 150, normalRange: "Per lab reference", sampleType: "Stool" },
  { name: "Widal Test", category: "Serology", price: 250, sampleType: "Serum" },
  { name: "H. pylori Antibody", category: "Serology", price: 350, sampleType: "Serum" },
  { name: "Hepatitis B Surface Antigen (HBsAg)", category: "Serology", price: 350, sampleType: "Serum" },
  { name: "Hepatitis C Antibody (Anti-HCV)", category: "Serology", price: 350, sampleType: "Serum" },
  { name: "HIV 1/2 Screening", category: "Serology", price: 400, sampleType: "Serum" },
  { name: "Pregnancy Test (Urine hCG)", category: "Serology", price: 150, sampleType: "Urine" },
  { name: "Thyroid Profile (T3, T4, TSH)", category: "Hormones", price: 900, normalRange: "Per lab reference", sampleType: "Serum" },
  { name: "Malaria Parasite Smear", category: "Hematology", price: 180, normalRange: "Negative", sampleType: "Blood" },
  { name: "Reticulocyte Count", category: "Hematology", price: 220, normalRange: "0.5-2.5", unit: "%", sampleType: "Whole blood" },
  { name: "Bleeding Time", category: "Hematology", price: 150, normalRange: "2-7", unit: "min", sampleType: "Capillary blood" },
  { name: "Clotting Time", category: "Hematology", price: 150, normalRange: "5-11", unit: "min", sampleType: "Whole blood" },
  { name: "Prothrombin Time (PT/INR)", category: "Coagulation", price: 350, normalRange: "INR 0.8-1.2", sampleType: "Citrated plasma" },
  { name: "Activated Partial Thromboplastin Time (APTT)", category: "Coagulation", price: 400, normalRange: "25-35", unit: "sec", sampleType: "Citrated plasma" },
  { name: "D-Dimer", category: "Coagulation", price: 850, normalRange: "< 500", unit: "ng/mL", sampleType: "Plasma" },
  { name: "C-Reactive Protein (CRP)", category: "Serology", price: 350, normalRange: "< 6", unit: "mg/L", sampleType: "Serum" },
  { name: "Rheumatoid Factor (RF)", category: "Serology", price: 350, normalRange: "< 14", unit: "IU/mL", sampleType: "Serum" },
  { name: "Anti-Streptolysin O (ASO)", category: "Serology", price: 350, normalRange: "< 200", unit: "IU/mL", sampleType: "Serum" },
  { name: "Typhidot IgM/IgG", category: "Serology", price: 450, normalRange: "Negative", sampleType: "Serum" },
  { name: "Dengue NS1 Antigen", category: "Serology", price: 700, normalRange: "Negative", sampleType: "Serum" },
  { name: "Dengue IgM/IgG", category: "Serology", price: 700, normalRange: "Negative", sampleType: "Serum" },
  { name: "Vitamin D (25-OH)", category: "Hormones", price: 1200, normalRange: "30-100", unit: "ng/mL", sampleType: "Serum" },
  { name: "Vitamin B12", category: "Hormones", price: 1000, normalRange: "200-900", unit: "pg/mL", sampleType: "Serum" },
  { name: "Ferritin", category: "Hormones", price: 900, normalRange: "Per lab reference", unit: "ng/mL", sampleType: "Serum" },
  { name: "TSH", category: "Hormones", price: 450, normalRange: "0.4-4.0", unit: "uIU/mL", sampleType: "Serum" },
  { name: "Free T4", category: "Hormones", price: 450, normalRange: "0.8-1.8", unit: "ng/dL", sampleType: "Serum" },
  { name: "Free T3", category: "Hormones", price: 450, normalRange: "2.3-4.2", unit: "pg/mL", sampleType: "Serum" },
  { name: "Beta hCG (Quantitative)", category: "Hormones", price: 800, normalRange: "Per lab reference", unit: "mIU/mL", sampleType: "Serum" },
  { name: "PSA Total", category: "Tumor Markers", price: 1000, normalRange: "< 4.0", unit: "ng/mL", sampleType: "Serum" },
  { name: "Troponin I", category: "Cardiac Markers", price: 900, normalRange: "Negative", sampleType: "Serum" },
  { name: "CK-MB", category: "Cardiac Markers", price: 600, normalRange: "Per lab reference", unit: "U/L", sampleType: "Serum" },
  { name: "Serum Amylase", category: "Biochemistry", price: 350, normalRange: "30-110", unit: "U/L", sampleType: "Serum" },
  { name: "Serum Lipase", category: "Biochemistry", price: 450, normalRange: "0-160", unit: "U/L", sampleType: "Serum" },
  { name: "Serum Albumin", category: "Biochemistry", price: 250, normalRange: "3.5-5.0", unit: "g/dL", sampleType: "Serum" },
  { name: "Total Protein", category: "Biochemistry", price: 250, normalRange: "6.0-8.3", unit: "g/dL", sampleType: "Serum" },
  { name: "Magnesium", category: "Electrolytes", price: 300, normalRange: "1.7-2.2", unit: "mg/dL", sampleType: "Serum" },
  { name: "Phosphorus", category: "Electrolytes", price: 300, normalRange: "2.5-4.5", unit: "mg/dL", sampleType: "Serum" },
  { name: "Urine Culture and Sensitivity", category: "Microbiology", price: 900, normalRange: "No growth", sampleType: "Urine" },
];

const RADIOLOGY_CATALOG = [
  { name: "X-Ray Chest PA View", category: "X-Ray", price: 350, sampleType: "Imaging" },
  { name: "X-Ray Chest Lateral View", category: "X-Ray", price: 350, sampleType: "Imaging" },
  { name: "X-Ray Abdomen Erect", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "X-Ray Pelvis AP", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "X-Ray Skull AP/Lateral", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Spine Cervical", category: "X-Ray", price: 500, sampleType: "Imaging" },
  { name: "X-Ray Spine Lumbar", category: "X-Ray", price: 500, sampleType: "Imaging" },
  { name: "X-Ray Knee AP/Lateral", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Hand AP/Oblique", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "Ultrasound Abdomen and Pelvis", category: "Ultrasound", price: 700, sampleType: "Imaging" },
  { name: "Ultrasound KUB", category: "Ultrasound", price: 600, sampleType: "Imaging" },
  { name: "Ultrasound Obstetric", category: "Ultrasound", price: 700, sampleType: "Imaging" },
  { name: "Ultrasound Breast", category: "Ultrasound", price: 700, sampleType: "Imaging" },
  { name: "Doppler Ultrasound Venous", category: "Doppler", price: 1200, sampleType: "Imaging" },
  { name: "ECG", category: "Cardiology", price: 200, sampleType: "Tracing" },
  { name: "X-Ray Shoulder AP", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Elbow AP/Lateral", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Wrist AP/Lateral", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "X-Ray Foot AP/Oblique", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "X-Ray Ankle AP/Lateral", category: "X-Ray", price: 400, sampleType: "Imaging" },
  { name: "X-Ray Hip AP", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Femur AP/Lateral", category: "X-Ray", price: 500, sampleType: "Imaging" },
  { name: "X-Ray Tibia/Fibula AP/Lateral", category: "X-Ray", price: 500, sampleType: "Imaging" },
  { name: "X-Ray Sinuses", category: "X-Ray", price: 450, sampleType: "Imaging" },
  { name: "X-Ray Nasal Bone", category: "X-Ray", price: 350, sampleType: "Imaging" },
  { name: "Ultrasound Pelvis", category: "Ultrasound", price: 600, sampleType: "Imaging" },
  { name: "Ultrasound Thyroid", category: "Ultrasound", price: 650, sampleType: "Imaging" },
  { name: "Ultrasound Scrotum", category: "Ultrasound", price: 700, sampleType: "Imaging" },
  { name: "Ultrasound Soft Tissue", category: "Ultrasound", price: 600, sampleType: "Imaging" },
  { name: "Ultrasound Appendix", category: "Ultrasound", price: 650, sampleType: "Imaging" },
  { name: "Ultrasound Liver/Gallbladder", category: "Ultrasound", price: 650, sampleType: "Imaging" },
  { name: "Doppler Ultrasound Arterial", category: "Doppler", price: 1300, sampleType: "Imaging" },
  { name: "Carotid Doppler", category: "Doppler", price: 1400, sampleType: "Imaging" },
  { name: "Echocardiography", category: "Cardiology", price: 1500, sampleType: "Imaging" },
  { name: "Treadmill Test (TMT)", category: "Cardiology", price: 1200, sampleType: "Tracing" },
  { name: "Holter Monitoring 24 Hours", category: "Cardiology", price: 2000, sampleType: "Monitoring" },
  { name: "CT Brain Plain", category: "CT Scan", price: 2500, sampleType: "Imaging" },
  { name: "CT Chest Plain", category: "CT Scan", price: 3500, sampleType: "Imaging" },
  { name: "CT Abdomen Plain", category: "CT Scan", price: 4000, sampleType: "Imaging" },
  { name: "CT KUB", category: "CT Scan", price: 3500, sampleType: "Imaging" },
  { name: "MRI Brain Plain", category: "MRI", price: 5500, sampleType: "Imaging" },
  { name: "MRI Lumbar Spine", category: "MRI", price: 5500, sampleType: "Imaging" },
  { name: "MRI Knee", category: "MRI", price: 5500, sampleType: "Imaging" },
  { name: "Mammography Bilateral", category: "Mammography", price: 2000, sampleType: "Imaging" },
  { name: "OPG Dental X-Ray", category: "Dental Imaging", price: 800, sampleType: "Imaging" },
];

const ensureLabCatalog = async () => {
  const categories = new Map();
  for (const type of ["pathology", "radiology"]) {
    const rows = type === "pathology" ? LAB_CATALOG : RADIOLOGY_CATALOG;
    for (const test of rows) {
      const key = `${type}:${test.category}`;
      if (!categories.has(key)) {
        let category = await prisma.labCategory.findFirst({ where: { type, name: { equals: test.category, mode: "insensitive" } } });
        if (!category) category = await prisma.labCategory.create({ data: { type, name: test.category } });
        categories.set(key, category);
      }
      const exists = await prisma.labTest.findFirst({ where: { type, name: { equals: test.name, mode: "insensitive" } } });
      if (!exists) {
        const { category, ...testData } = test;
        await prisma.labTest.create({
          data: {
            ...testData,
            type,
            categoryId: categories.get(key).id,
            normalRange: test.normalRange || null,
            unit: test.unit || null,
          },
        });
      }
      const charge = await prisma.charge.findFirst({ where: { category: type === "radiology" ? "radiology" : "lab", name: { equals: test.name, mode: "insensitive" } } });
      if (!charge) {
        await prisma.charge.create({
          data: {
            name: test.name,
            category: type === "radiology" ? "radiology" : "lab",
            standardCharge: test.price,
            chargeType: "fixed",
            unit: "service",
            taxPercent: 0,
          },
        });
      }
    }
  }
};

const run = async () => {
  console.log("\n=== Seeding clinic system ===\n");

  const credentials = [];
  for (const u of DEMO_USERS) {
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (exists) {
      console.log(`- ${roleLabel(u.role)} already exists (${u.username}), skipping.`);
      continue;
    }
    const staffId = await nextSequence("STAFF", "STF", 4);
    const password = passwordFor(u.username);
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        staffId,
        name: u.name,
        username: u.username,
        email: `${u.username}@example.com`,
        role: u.role,
        department: u.department,
        designation: u.designation,
        passwordHash,
      },
    });
    credentials.push({ role: roleLabel(u.role), username: u.username, password });
  }

  const settingsCount = await prisma.setting.count();
  if (settingsCount === 0) {
    await prisma.setting.create({
      data: { clinicName: "My OPD Clinic", tagline: "Outpatient Department Management", currency: "AFN", defaultLanguage: "en", invoicePrefix: "INV" },
    });
    console.log("- Created default clinic settings.");
  } else {
    console.log("- Clinic settings already exist, skipping.");
  }

  const vitalCount = await prisma.vital.count();
  if (vitalCount === 0) {
    await prisma.vital.createMany({
      data: [
        { name: "Temperature", referenceRange: "36.1 - 37.2", unit: "°C" },
        { name: "Blood Pressure", referenceRange: "90/60 - 120/80", unit: "mmHg" },
        { name: "Pulse Rate", referenceRange: "60 - 100", unit: "bpm" },
        { name: "Respiratory Rate", referenceRange: "12 - 20", unit: "breaths/min" },
        { name: "SpO2", referenceRange: "95 - 100", unit: "%" },
        { name: "Weight", referenceRange: "-", unit: "kg" },
        { name: "Height", referenceRange: "-", unit: "cm" },
      ],
    });
    console.log("- Seeded default vitals.");
  } else {
    console.log("- Vitals already seeded, skipping.");
  }

  const opCount = await prisma.operation.count();
  if (opCount === 0) {
    await prisma.operation.createMany({
      data: [
        { name: "Appendectomy", category: "General Surgery" },
        { name: "Cataract Surgery", category: "Ophthalmology" },
        { name: "Cesarean Section", category: "Obstetrics" },
        { name: "Hernia Repair", category: "General Surgery" },
      ],
    });
    console.log("- Seeded default operation types.");
  } else {
    console.log("- Operation types already seeded, skipping.");
  }

  // Every OPD visit, lab test, pharmacy sale, optical sale and procedure gets
  // billed — this is the starter price list so Billing/OPD/Lab have real
  // charges to pick from the moment the system comes up.
  const chargeCount = await prisma.charge.count();
  if (chargeCount === 0) {
    const presets = [
      { name: "General Consultation", category: "opd", standardCharge: 200 },
      { name: "Specialist Consultation", category: "opd", standardCharge: 400 },
      { name: "Follow-up Visit", category: "opd", standardCharge: 100 },
      { name: "Complete Blood Count (CBC)", category: "lab", standardCharge: 250 },
      { name: "Blood Sugar (Random)", category: "lab", standardCharge: 100 },
      { name: "Urine Routine Examination", category: "lab", standardCharge: 150 },
      { name: "X-Ray (Single View)", category: "radiology", standardCharge: 350 },
      { name: "Ultrasound - Abdomen", category: "radiology", standardCharge: 600 },
      { name: "ECG", category: "lab", standardCharge: 200 },
      { name: "Minor Procedure / Dressing", category: "operation", standardCharge: 300 },
      { name: "Ambulance Service", category: "other", standardCharge: 500 },
      { name: "Bed Charge (per day)", category: "other", standardCharge: 800 },
    ];
    await prisma.charge.createMany({ data: presets.map((p) => ({ ...p, chargeType: "fixed", unit: "service", taxPercent: 0 })) });
    console.log("- Seeded starter charge list.");
  } else {
    console.log("- Charges already seeded, skipping.");
  }

  await ensureLabCatalog();
  console.log("- Ensured laboratory and radiology test catalog.");

  const patientCount = await prisma.patient.count();
  if (patientCount === 0) {
    const patientId = await nextSequence("PATIENT", "PAT", 5);
    await prisma.patient.create({
      data: { patientId, name: "Demo Patient", phone: "0700000000", gender: "male", dob: new Date(1990, 0, 1) },
    });
    console.log("- Created one demo patient to test OPD/billing/lab/pharmacy with.");
  } else {
    console.log("- Patients already exist, skipping demo patient.");
  }

  if (credentials.length) {
    console.log("\n=== Demo logins created (change these passwords before going live) ===");
    console.log(`${"Role".padEnd(20)}${"Username".padEnd(16)}Password`);
    credentials.forEach((c) => console.log(`${c.role.padEnd(20)}${c.username.padEnd(16)}${c.password}`));
  }

  console.log("\nSeed complete.\n");
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
