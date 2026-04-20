-- 讓用戶可以刪除自己的帳號
-- security definer 讓這個 function 以擁有者身份執行，才能操作 auth.users
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
