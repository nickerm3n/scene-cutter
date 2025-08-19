// Скрипт для обновления версии при билде
import fs from 'fs';
import path from 'path';

function updateVersion() {
  const configPath = path.join(process.cwd(), 'browser-extension', 'config.js');
  
  try {
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Генерируем новую версию на основе времени
    const now = new Date();
    const version = `1.0.${Math.floor(now.getTime() / 1000)}`;
    const buildDate = now.toISOString();
    
    // Обновляем версию и дату билда
    configContent = configContent.replace(
      /VERSION:\s*"[^"]*"/,
      `VERSION: "${version}"`
    );
    
    configContent = configContent.replace(
      /BUILD_DATE:\s*new Date\(\)\.toISOString\(\)/,
      `BUILD_DATE: "${buildDate}"`
    );
    
    fs.writeFileSync(configPath, configContent);
    
    console.log(`✅ Версия обновлена: ${version}`);
    console.log(`📅 Дата билда: ${buildDate}`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении версии:', error);
  }
}

// Запускаем обновление версии
updateVersion();
