import fs from 'fs';

async function upload() {
  const filePath = 'c:\\Users\\Wael_\\Downloads\\boy and girl kessa\\dist\\public\\uploads\\child-photos\\1-1776812362047_dd289d84.jpg';
  const fileData = fs.readFileSync(filePath);
  const blob = new Blob([fileData], { type: 'image/jpeg' });
  
  const formData = new FormData();
  formData.append('file', blob, 'child.jpg');
  
  try {
    const response = await fetch('https://file.io', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    console.log('Link:', data.link);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

upload();
