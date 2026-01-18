declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword?: string;
    keywords?: string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number | string;
    property?: string;
    resolution?: string;
    granularTimeResolution?: boolean;
  }

  interface DailyTrendsOptions {
    trendDate?: Date;
    geo?: string;
    hl?: string;
  }

  interface RealTimeTrendsOptions {
    geo?: string;
    hl?: string;
    category?: string;
  }

  interface RelatedQueriesOptions {
    keyword: string;
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
  }

  function interestOverTime(options: TrendsOptions): Promise<string>;
  function interestByRegion(options: TrendsOptions): Promise<string>;
  function relatedTopics(options: TrendsOptions): Promise<string>;
  function relatedQueries(options: RelatedQueriesOptions): Promise<string>;
  function dailyTrends(options: DailyTrendsOptions): Promise<string>;
  function realTimeTrends(options: RealTimeTrendsOptions): Promise<string>;
  function autoComplete(options: { keyword: string }): Promise<string>;

  export {
    interestOverTime,
    interestByRegion,
    relatedTopics,
    relatedQueries,
    dailyTrends,
    realTimeTrends,
    autoComplete,
  };

  export default {
    interestOverTime,
    interestByRegion,
    relatedTopics,
    relatedQueries,
    dailyTrends,
    realTimeTrends,
    autoComplete,
  };
}
