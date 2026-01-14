import { NextResponse } from 'next/server';
import { generateAndPost } from '@/lib/instagramgen';

export async function GET() {
  try {
    const result = await generateAndPost();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}