import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { setStep, setTopic } from '@/lib/pipeline';

export const maxDuration = 300; // 5 minutes max

// Strip ANSI escape codes from terminal output
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, topic, voiceTone } = body;

    // Load settings to check Unsplash status
    const { getSettings } = await import('@/lib/store');
    const settings = await getSettings();

    // Set environment variables for the child process
    const env = {
      ...process.env,
      ARTICLE_TOPIC: topic || '',
      VOICE_TONE: voiceTone || process.env.VOICE_TONE || 'conversational',
      UNSPLASH_ENABLED: settings.unsplashEnabled ? 'true' : 'false',
    };

    // Path to the main pipeline script
    const projectRoot = path.join(process.cwd(), '..');
    
    return new Promise<NextResponse>((resolve) => {
      const child = spawn('npm', ['run', 'start'], {
        cwd: projectRoot,
        env,
        shell: true,
      });

      let output = '';
      let errorOutput = '';
      let result: {
        title?: string;
        slug?: string;
        wordCount?: number;
        postUrl?: string;
        postId?: number;
      } = {};

      child.stdout.on('data', (data) => {
        const rawText = data.toString();
        output += rawText;
        
        // Strip ANSI codes for clean parsing
        const text = stripAnsi(rawText);
        
        // Parse log messages for status updates
        if (text.includes('Testing WordPress')) {
          setStep('connecting', 'Testing WordPress connection...');
        } else if (text.includes('Discovering trending topic')) {
          setStep('trends', 'Discovering trending topic...');
        } else if (text.includes('Classifying topic cluster')) {
          setStep('cluster', 'Classifying topic cluster...');
        } else if (text.includes('Analyzing competitors')) {
          setStep('competitors', 'Analyzing competitors...');
        } else if (text.includes('Generating keywords')) {
          setStep('keywords', 'Generating keywords...');
        } else if (text.includes('Generating outline')) {
          setStep('outline', 'Generating article outline...');
        } else if (text.includes('Generating article content') || text.includes('Generating article with unique angle')) {
          setStep('content', 'Writing article content...');
        } else if (text.includes('Checking and improving originality')) {
          setStep('originality', 'Checking originality...');
        } else if (text.includes('Humanizing article')) {
          setStep('humanize', 'Humanizing content...');
        } else if (text.includes('Optimizing readability')) {
          setStep('readability', 'Optimizing readability...');
        } else if (text.includes('Generating FAQ')) {
          setStep('faq', 'Generating FAQ...');
        } else if (text.includes('Generating table of contents')) {
          setStep('toc', 'Generating table of contents...');
        } else if (text.includes('Fetching featured image')) {
          setStep('image', 'Fetching featured image...');
        } else if (text.includes('Featured image uploaded')) {
          setStep('image', 'Featured image ready!');
        } else if (text.includes('Adding internal links')) {
          setStep('internal_links', 'Adding internal links...');
        } else if (text.includes('Generating schema markup')) {
          setStep('schema', 'Generating schema markup...');
        } else if (text.includes('Publishing to WordPress')) {
          setStep('publish', 'Publishing to WordPress...');
        } else if (text.includes('Selected topic:')) {
          const match = text.match(/Selected topic: (.+)/);
          if (match) setTopic(match[1].trim());
        } else if (text.includes('Published:')) {
          const match = text.match(/Published: (https?:\/\/[^\s]+)/);
          if (match) result.postUrl = match[1];
        }
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Strip ANSI codes from output for clean parsing
          const cleanOutput = stripAnsi(output);
          
          // Parse successful output for article details
          const titleMatch = cleanOutput.match(/Article: (.+)/);
          // Match the last "X words" occurrence — section-by-section logs emit
          // multiple word counts (intro, each section, conclusion) before the final total
          const wordMatches = Array.from(cleanOutput.matchAll(/(\d+) words/g));
          const wordMatch = wordMatches.length > 0 ? wordMatches[wordMatches.length - 1] : null;
          
          // Clean the slug (remove any trailing special characters)
          const rawSlug = result.postUrl?.split('/').filter(Boolean).pop() || '';
          const cleanSlug = rawSlug.replace(/[^\w-]/g, '');
          
          resolve(NextResponse.json({
            success: true,
            title: titleMatch ? titleMatch[1].trim() : 'Generated Article',
            slug: cleanSlug,
            wordCount: wordMatch ? parseInt(wordMatch[1]) : 0,
            postUrl: result.postUrl,
          }));
        } else {
          resolve(NextResponse.json(
            { 
              success: false, 
              message: stripAnsi(errorOutput) || 'Pipeline execution failed',
            },
            { status: 500 }
          ));
        }
      });

      child.on('error', (error) => {
        resolve(NextResponse.json(
          { success: false, message: error.message },
          { status: 500 }
        ));
      });
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
