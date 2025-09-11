// Test file to verify pdf-lib imports
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function testPdfLib() {
  try {
    console.log('Testing pdf-lib imports...');
    
    // Test PDFDocument
    const pdfDoc = await PDFDocument.create();
    console.log('✓ PDFDocument imported successfully');
    
    // Test StandardFonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.log('✓ StandardFonts imported successfully');
    
    // Test rgb
    const color = rgb(0, 0, 0);
    console.log('✓ rgb function imported successfully');
    
    console.log('\nAll pdf-lib imports are working correctly!');
  } catch (error) {
    console.error('Error testing pdf-lib:', error.message);
  }
}

testPdfLib();
