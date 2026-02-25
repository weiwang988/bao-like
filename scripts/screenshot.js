const puppeteer = require('puppeteer');
const path = require('path');

async function captureScreenshots() {
  const browser = await puppeteer.launch({
    headless: false, // 需要显示界面来获取Electron应用截图
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    // 等待应用启动
    console.log('等待应用启动...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pages = await browser.pages();
    const page = pages[0];
    
    // 设置视口大小
    await page.setViewport({ width: 1200, height: 800 });
    
    // 定义要截图的页面
    const screenshots = [
      {
        name: '工具管理',
        path: '/environment/package',
        filename: 'package-manager.png'
      },
      {
        name: '包管理', 
        path: '/environment/deps',
        filename: 'package-deps.png'
      },
      {
        name: '包缓存',
        path: '/environment/cache', 
        filename: 'package-cache.png'
      }
    ];
    
    // 创建截图目录
    const screenshotDir = path.join(__dirname, '..', 'screenshots');
    const fs = require('fs');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    
    // 截图每个页面
    for (const shot of screenshots) {
      console.log(`正在截图: ${shot.name}`);
      
      // 导航到指定路径
      await page.goto(`http://localhost:5173/#${shot.path}`, { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });
      
      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 截图
      const screenshotPath = path.join(screenshotDir, shot.filename);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
      
      console.log(`已保存: ${screenshotPath}`);
    }
    
    console.log('所有截图完成！');
    
  } catch (error) {
    console.error('截图过程中出错:', error);
  } finally {
    // 不关闭浏览器，让用户可以查看结果
    console.log('截图完成，浏览器保持打开状态');
  }
}

// 运行截图
captureScreenshots().catch(console.error);