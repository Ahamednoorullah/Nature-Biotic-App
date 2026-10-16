-- Correct purchase-return dates that were saved as the UTC calendar date
-- between midnight and 05:30 Asia/Kolkata. The form used toISOString(), so a
-- return created on 16 Oct 2026 IST was stored as 15 Oct. SAI-PR-0001 is unchanged.

update public.purchase_returns pr
   set return_date = (pr.created_at at time zone 'Asia/Kolkata')::date
 where pr.return_date = (pr.created_at at time zone 'UTC')::date
   and pr.return_date is distinct from (pr.created_at at time zone 'Asia/Kolkata')::date
   and (pr.created_at at time zone 'Asia/Kolkata')::time < time '05:30:00';

update public.company_credit_notes cn
   set credit_note_date = (pr.created_at at time zone 'Asia/Kolkata')::date
  from public.company_credit_note_items cni
  join public.purchase_return_items pri on pri.id = cni.purchase_return_item_id
  join public.purchase_returns pr on pr.id = pri.return_id
 where cn.id = cni.credit_note_id
   and cn.credit_note_date = (pr.created_at at time zone 'UTC')::date
   and cn.credit_note_date is distinct from (pr.created_at at time zone 'Asia/Kolkata')::date
   and (cn.created_at at time zone 'Asia/Kolkata')::time < time '05:30:00';
