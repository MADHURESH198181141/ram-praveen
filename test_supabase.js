import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfrbuchequelcyrxxglb.supabase.co';
const supabaseKey = 'sb_publishable_esWl606fQJKZtZYgRnUuuw_u-kFKeaJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('bills').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success, bills table data count:', data.length);
    data.forEach(bill => {
      console.log(`Bill: ${bill.billNumber}, Customer: ${bill.customerName}, EmployeeName: ${bill.employeeName}, EmployeeID: ${bill.employeeId}`);
    });
  }
}
test();
