import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();
// 환경변수에서 토큰/DB ID 가져오기
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error(
    '❌ 환경변수 NOTION_TOKEN 또는 NOTION_DATABASE_ID 가 없습니다.'
  );
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function debugDatabaseAndFirstPage(databaseId) {
  try {
    // ✅ DB 메타데이터 가져오기
    const db = await notion.request({
      path: `databases/${databaseId}`,
      method: 'GET',
    });

    console.log('✅ Database ID:', databaseId);
    console.log(
      '📋 Database Title:',
      db.title?.[0]?.plain_text || '(제목 없음)'
    );

    // ✅ data_source ID 확인
    const ds = db.data_sources?.[0];
    if (!ds) {
      console.error('❌ 해당 DB에서 data_source_id 를 찾을 수 없습니다.');
      process.exit(1);
    }
    console.log('✅ Data Source ID:', ds.id);
    console.log('✅ Data Source Name:', ds.name || '(no name)');

    // ✅ 첫 페이지 하나 조회
    const res = await notion.request({
      path: `data_sources/${ds.id}/query`,
      method: 'POST',
      body: { page_size: 1 },
    });

    if (res.results.length === 0) {
      console.log('⚠️ 데이터베이스에 페이지가 없습니다.');
      return;
    }

    const page = res.results[0];
    console.log('📝 첫 페이지 ID:', page.id);
    console.log(
      '📝 첫 페이지 properties:',
      JSON.stringify(page.properties, null, 2)
    );

    // ✅ 제목 속성만 별도로 출력 (type === 'title')
    for (const [key, val] of Object.entries(page.properties)) {
      if (val.type === 'title') {
        const titleText = val.title.map((t) => t.plain_text).join('');
        console.log(`🏷️ Title property key: "${key}", value: "${titleText}"`);
      }
    }
  } catch (err) {
    console.error('❌ 요청 실패:', err.message);
    if (err.body) console.error('API Error Body:', err.body);
  }
}

debugDatabaseAndFirstPage(DATABASE_ID);
