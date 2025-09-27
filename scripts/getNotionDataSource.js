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

async function getDataSourceId(databaseId) {
  try {
    // DB 메타데이터 가져오기
    const db = await notion.request({
      path: `databases/${databaseId}`,
      method: 'GET',
    });

    // data_sources 확인
    const ds = db.data_sources?.[0];
    if (!ds) {
      console.error('❌ 해당 DB에서 data_source_id 를 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log('✅ Database ID:', databaseId);
    console.log('✅ Data Source ID:', ds.id);
    console.log('✅ Data Source Name:', ds.name || '(no name)');
  } catch (err) {
    console.error('❌ 요청 실패:', err.message);
    if (err.body) console.error('API Error Body:', err.body);
  }
}

getDataSourceId(DATABASE_ID);
