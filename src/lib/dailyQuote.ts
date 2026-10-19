/** Deterministic daily quote — cycles by day-of-year so it changes every day. */

interface Quote {
  text: string;
  author: string;
}

const QUOTES: Quote[] = [
  { text: 'The only bad workout is the one that didn\'t happen.', author: 'Unknown' },
  { text: 'Success is usually the culmination of controlling failure.', author: 'Sylvester Stallone' },
  { text: 'No pain, no gain. Shut up and train.', author: 'Unknown' },
  { text: 'Strength does not come from the physical capacity. It comes from an indomitable will.', author: 'Mahatma Gandhi' },
  { text: 'Take care of your body. It\'s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'The difference between try and triumph is a little umph.', author: 'Marvin Phillips' },
  { text: 'A one-hour workout is 4% of your day. No excuses.', author: 'Unknown' },
  { text: 'Your body can stand almost anything. It\'s your mind you have to convince.', author: 'Unknown' },
  { text: 'Push yourself because no one else is going to do it for you.', author: 'Unknown' },
  { text: 'Don\'t stop when you\'re tired. Stop when you\'re done.', author: 'Unknown' },
  { text: 'What seems impossible today will one day become your warm-up.', author: 'Unknown' },
  { text: 'Once you see results, it becomes an addiction.', author: 'Unknown' },
  { text: 'The hard days are the best because that\'s when champions are made.', author: 'Gabby Douglas' },
  { text: 'If it doesn\'t challenge you, it doesn\'t change you.', author: 'Fred DeVito' },
  { text: 'Train insane or remain the same.', author: 'Unknown' },
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Fall in love with taking care of yourself — mind, body, spirit.', author: 'Unknown' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'The gym is a chess match. Think before you lift.', author: 'Unknown' },
  { text: 'Sweat is just fat crying.', author: 'Unknown' },
  { text: 'You are one workout away from a good mood.', author: 'Unknown' },
  { text: 'Strive for progress, not perfection.', author: 'Unknown' },
  { text: 'Be stronger than your strongest excuse.', author: 'Unknown' },
  { text: 'Your only competition is who you were yesterday.', author: 'Unknown' },
  { text: 'Results happen over time, not overnight. Work hard, stay consistent, be patient.', author: 'Unknown' },
  { text: 'Earn your body.', author: 'Unknown' },
  { text: 'Every rep is a vote for the person you\'re becoming.', author: 'Unknown' },
  { text: 'Discipline is doing it even when you don\'t feel like it.', author: 'Unknown' },
  { text: 'The groundwork for all happiness is good health.', author: 'Leigh Hunt' },
  { text: 'Go the extra mile — it\'s never crowded there.', author: 'Wayne Dyer' },
  { text: 'If you want something you\'ve never had, you must do something you\'ve never done.', author: 'Thomas Jefferson' },
  { text: 'Champions aren\'t made in the gyms. Champions are made from something inside.', author: 'Muhammad Ali' },
  { text: 'The difference between who you are and who you want to be is what you do.', author: 'Unknown' },
  { text: 'Rome wasn\'t built in a day, but they were laying bricks every hour.', author: 'John Heywood' },
  { text: 'Obsessed is a word the lazy use to describe the dedicated.', author: 'Unknown' },
  { text: 'Good things come to those who sweat.', author: 'Unknown' },
  { text: 'It never gets easier, you just get stronger.', author: 'Unknown' },
  { text: 'The body achieves what the mind believes.', author: 'Unknown' },
  { text: 'You are what you repeatedly do.', author: 'Aristotle' },
  { text: 'Make yourself a priority — at the end of the day, you\'re your longest commitment.', author: 'Unknown' },
  { text: 'Just one more rep.', author: 'Unknown' },
  { text: 'Your health is an investment, not an expense.', author: 'Unknown' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'Small steps every day lead to big results.', author: 'Unknown' },
  { text: 'The pain you feel today will be the strength you feel tomorrow.', author: 'Unknown' },
  { text: 'Don\'t wish for it. Work for it.', author: 'Unknown' },
  { text: 'You\'re not here to be average. You\'re here to be awesome.', author: 'Unknown' },
  { text: 'Consistency over intensity — every time.', author: 'Unknown' },
  { text: 'The first step is the hardest. Then momentum takes over.', author: 'Unknown' },
  { text: 'Your future self is watching you right now through your memories.', author: 'Unknown' },
  { text: 'Strength is not given. It is earned.', author: 'Unknown' },
  { text: 'Show up. Do the work. Trust the process.', author: 'Unknown' },
  { text: 'In training, you listen to your body. In competition, you tell your body to shut up.', author: 'Rich Froning' },
  { text: 'A strong body makes the mind strong.', author: 'Thomas Jefferson' },
  { text: 'Even the longest journey begins with a single step.', author: 'Lao Tzu' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Don\'t limit your challenges — challenge your limits.', author: 'Unknown' },
  { text: 'Every workout is a step toward the best version of you.', author: 'Unknown' },
  { text: 'Wake up determined. Go to bed satisfied.', author: 'Unknown' },
  { text: 'The clock is ticking. Are you becoming the person you want to be?', author: 'Greg Plitt' },
  { text: 'Iron is the best antidepressant.', author: 'Henry Rollins' },
];

export function getDailyQuote(): Quote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length]!;
}
