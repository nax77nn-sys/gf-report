const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const path = require('path');

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const DAY_NAMES = [
  'Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'
];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Genera il PDF del foglio mensile dipendente per GF REPORT
 */
function generateEmployeePdf(user, timesheet, year, month, stream) {
  const doc = new PDFDocument({
    margin: 30,
    size: 'A4',
    bufferPages: true
  });

  doc.pipe(stream);

  const monthName = MONTH_NAMES[month - 1];

  // Intestazione GF REPORT
  doc.rect(30, 25, 535, 52).fill('#1E3A8A');

  // Verifica se esiste un logo caricato in public/
  const logoPng = path.join(__dirname, '..', '..', 'public', 'logo.png');
  const logoJpg = path.join(__dirname, '..', '..', 'public', 'logo.jpg');
  const logoJpeg = path.join(__dirname, '..', '..', 'public', 'logo.jpeg');

  let logoPath = null;
  if (fs.existsSync(logoPng)) logoPath = logoPng;
  else if (fs.existsSync(logoJpg)) logoPath = logoJpg;
  else if (fs.existsSync(logoJpeg)) logoPath = logoJpeg;

  if (logoPath) {
    try {
      doc.roundedRect(35, 29, 44, 44, 6).fill('#FFFFFF');
      doc.image(logoPath, 37, 31, { fit: [40, 40] });
    } catch (e) {
      console.error('Errore embedding logo PDF:', e);
    }
  }

  doc.fillColor('#FFFFFF')
     .fontSize(15)
     .font('Helvetica-Bold')
     .text(`GF REPORT - FOGLIO PRESENZE ${monthName.toUpperCase()} ${year}`, 88, 33, {
       align: 'left',
       width: 470
     });

  doc.fontSize(8.5)
     .font('Helvetica')
     .fillColor('#93C5FD')
     .text('GF IMPIANTI ELETTRICI CIVILI ED INDUSTRIALI', 88, 54, {
       align: 'left',
       width: 470
     });

  // Box Dati Dipendente
  doc.fillColor('#000000')
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(`Dipendente: ${user.surname} ${user.name}`, 35, 88);

  doc.font('Helvetica')
     .text(`Email: ${user.email}`, 35, 102);

  const statusText = timesheet && timesheet.isLocked ? 'STATO: CONFERMATO / BLOCCATO' : 'STATO: IN COMPILAZIONE';
  doc.font('Helvetica-Bold')
     .fillColor(timesheet && timesheet.isLocked ? '#15803D' : '#D97706')
     .text(statusText, 350, 88, { align: 'right', width: 210 });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(9)
     .text(`Emesso il: ${new Date().toLocaleDateString('it-IT')}`, 350, 102, { align: 'right', width: 210 });

  doc.fillColor('#000000');

  // Preparazione tabella giorni
  const numDays = getDaysInMonth(year, month);
  const daysData = (timesheet && timesheet.days) || {};

  let totOrd = 0;
  let totStr = 0;
  let totViag = 0;
  let totFerie = 0;
  let totMal = 0;
  let totRep = 0;
  let totSpese = 0;

  const rows = [];
  for (let d = 1; d <= numDays; d++) {
    const curDate = new Date(year, month - 1, d);
    const dayName = DAY_NAMES[curDate.getDay()];

    const dayInfo = daysData[d] || {};
    const ord = parseFloat(dayInfo.ordinaryHours) || 0;
    const str = parseFloat(dayInfo.overtimeHours) || 0;
    const viag = parseFloat(dayInfo.travelHours) || 0;
    const ferie = parseFloat(dayInfo.ferieHours) || 0;
    const mal = parseFloat(dayInfo.malattiaHours) || 0;
    const rep = dayInfo.onCall ? 'Sì' : '-';

    let daySpese = 0;
    let noteParts = [];

    if (Array.isArray(dayInfo.expenses)) {
      dayInfo.expenses.forEach(e => {
        const val = parseFloat(e.amount) || 0;
        daySpese += val;
        if (e.description) noteParts.push(`${e.description} (€${val.toFixed(2)})`);
      });
    } else if (dayInfo.expenseAmount) {
      daySpese = parseFloat(dayInfo.expenseAmount) || 0;
      if (dayInfo.expenseDescription) noteParts.push(dayInfo.expenseDescription);
    }

    if (dayInfo.notes) {
      noteParts.push(dayInfo.notes);
    }

    totOrd += ord;
    totStr += str;
    totViag += viag;
    totFerie += ferie;
    totMal += mal;
    if (dayInfo.onCall) totRep++;
    totSpese += daySpese;

    rows.push([
      `${d} (${dayName})`,
      ord > 0 ? ord.toFixed(1) : '-',
      str > 0 ? str.toFixed(1) : '-',
      viag > 0 ? viag.toFixed(1) : '-',
      ferie > 0 ? ferie.toFixed(1) : '-',
      mal > 0 ? mal.toFixed(1) : '-',
      rep,
      daySpese > 0 ? `€ ${daySpese.toFixed(2)}` : '-',
      noteParts.join('; ').substring(0, 40)
    ]);
  }

  // Riga Totali
  rows.push([
    'TOTALI',
    totOrd.toFixed(1),
    totStr.toFixed(1),
    totViag.toFixed(1),
    totFerie.toFixed(1),
    totMal.toFixed(1),
    `${totRep} gg`,
    `€ ${totSpese.toFixed(2)}`,
    ''
  ]);

  const table = {
    title: '',
    headers: [
      { label: 'Giorno', width: 50, align: 'center' },
      { label: 'Ord.', width: 45, align: 'center' },
      { label: 'Straord.', width: 45, align: 'center' },
      { label: 'Viaggio', width: 45, align: 'center' },
      { label: 'Ferie', width: 40, align: 'center' },
      { label: 'Malat.', width: 40, align: 'center' },
      { label: 'Reper.', width: 40, align: 'center' },
      { label: 'Spese (€)', width: 55, align: 'right' },
      { label: 'Note / Dettagli Spese', width: 175, align: 'left' }
    ],
    rows: rows
  };

  doc.y = 125;

  doc.table(table, {
    prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF'),
    prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
      doc.font('Helvetica').fontSize(7.5).fillColor('#0F172A');
      if (indexRow === rows.length - 1) {
        doc.font('Helvetica-Bold');
      }
    },
    padding: 2.5,
    divider: {
      header: { disabled: false, width: 1, opacity: 1 },
      horizontal: { disabled: false, width: 0.5, opacity: 0.3 }
    }
  }).then(() => {
    // Sezione Reperibilità
    if (timesheet && timesheet.onCallWeeks && timesheet.onCallWeeks.length > 0) {
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E3A8A').text('Settimane di Reperibilità Registrate:');
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
      timesheet.onCallWeeks.forEach((w, i) => {
        doc.text(`• Periodo ${i + 1}: dal ${w.startDate || '-'} al ${w.endDate || '-'} ${w.notes ? '— ' + w.notes : ''}`);
      });
    }

    // Firme a fondo pagina
    doc.moveDown(2);
    const signY = doc.y > 700 ? 730 : Math.max(doc.y + 20, 710);
    
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    doc.text('Firma del Lavoratore', 40, signY);
    doc.text('Firma Datore di Lavoro (GF REPORT)', 340, signY);

    doc.moveTo(40, signY + 35).lineTo(200, signY + 35).stroke('#94A3B8');
    doc.moveTo(340, signY + 35).lineTo(520, signY + 35).stroke('#94A3B8');

    doc.end();
  }).catch(err => {
    console.error('Errore generazione tabella PDF:', err);
    doc.end();
  });
}

module.exports = {
  generateEmployeePdf
};
