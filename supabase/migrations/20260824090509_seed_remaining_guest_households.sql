do $seed$
declare
  item jsonb;
  v_household_id uuid;
begin
  for item in select value from jsonb_array_elements($json$[
    {"id":"10000000-0000-4000-8000-000000000002","slug":"wilder-hernani","label":"Wilder Hernani, Llewyn, & Justus","greeting":"Wilder, Llewyn, and Justus","guests":["Wilder Hernani","Llewyn","Justus"]},
    {"id":"10000000-0000-4000-8000-000000000003","slug":"tania-doukas","label":"Tania Doukas, Jesus, & Milenka","greeting":"Tania, Jesus, and Milenka","guests":["Tania Doukas","Jesus","Milenka"]},
    {"id":"10000000-0000-4000-8000-000000000005","slug":"diasanta","label":"Ate Michi Diasanta & Duane","greeting":"Ate Michi and Duane","guests":["Ate Michi Diasanta","Duane"]},
    {"id":"10000000-0000-4000-8000-000000000007","slug":"murao-jeff-joyce","label":"Uncle Jeff Murao, Auntie Joyce Murao, Justine, & Jade","greeting":"Uncle Jeff, Auntie Joyce, Justine, and Jade","guests":["Uncle Jeff Murao","Auntie Joyce Murao","Justine","Jade"]},
    {"id":"10000000-0000-4000-8000-000000000008","slug":"armada-larry-babette","label":"Uncle Larry Armada, Auntie Babette Armada, & Richard","greeting":"Uncle Larry, Auntie Babette, and Richard","guests":["Uncle Larry Armada","Auntie Babette Armada","Richard"]},
    {"id":"10000000-0000-4000-8000-000000000009","slug":"armada-renz-queenie","label":"Renz Armada, Queenie Armada, and Gabryiel","greeting":"Renz, Queenie, and Gabryiel","guests":["Renz Armada","Queenie Armada","Gabryiel"]},
    {"id":"10000000-0000-4000-8000-000000000010","slug":"armada-jd-georgia","label":"JD Armada and Georgia Steinheimer","greeting":"JD and Georgia","guests":["JD Armada","Georgia Steinheimer"]},
    {"id":"10000000-0000-4000-8000-000000000011","slug":"francisco-judy","label":"Auntie Judy Francisco, Judy Ann, & Angelo","greeting":"Auntie Judy, Judy Ann, and Angelo","guests":["Auntie Judy Francisco","Judy Ann","Angelo"]},
    {"id":"10000000-0000-4000-8000-000000000012","slug":"francisco-jasmin","label":"Jasmin Francisco & Jordan","greeting":"Jasmin and Jordan","guests":["Jasmin Francisco","Jordan"]},
    {"id":"10000000-0000-4000-8000-000000000013","slug":"francisco-jamie","label":"Jamie Francisco & Ryan","greeting":"Jamie and Ryan","guests":["Jamie Francisco","Ryan"]},
    {"id":"10000000-0000-4000-8000-000000000014","slug":"jeannie-viray","label":"Auntie Jeannie Viray","greeting":"Auntie Jeannie","guests":["Auntie Jeannie Viray"]},
    {"id":"10000000-0000-4000-8000-000000000015","slug":"viray","label":"Jordan Viray, Kim Canosa, & Rolando","greeting":"Jordan, Kim, and Rolando","guests":["Jordan Viray","Kim Canosa","Rolando"]},
    {"id":"10000000-0000-4000-8000-000000000016","slug":"murao-jerome","label":"Uncle Jerome Murao","greeting":"Uncle Jerome","guests":["Uncle Jerome Murao"]},
    {"id":"10000000-0000-4000-8000-000000000017","slug":"murao-juliet-ferdie","label":"Auntie Juliet Murao & Ferdie","greeting":"Auntie Juliet and Ferdie","guests":["Auntie Juliet Murao","Ferdie"]},
    {"id":"10000000-0000-4000-8000-000000000018","slug":"stallard","label":"Auntie Jojie Stallard, Johnny, Jayteal, & Art","greeting":"Auntie Jojie, Johnny, Jayteal, and Art","guests":["Auntie Jojie Stallard","Johnny","Jayteal","Art"]},
    {"id":"10000000-0000-4000-8000-000000000020","slug":"smith","label":"Auntie Janette Smith, Uncle Reuben, & Kenny","greeting":"Auntie Janette, Uncle Reuben, and Kenny","guests":["Auntie Janette Smith","Uncle Reuben","Kenny"]},
    {"id":"10000000-0000-4000-8000-000000000021","slug":"drelick","label":"Auntie Jean Drelick & Uncle Dennis Drelick","greeting":"Auntie Jean and Uncle Dennis","guests":["Auntie Jean Drelick","Uncle Dennis Drelick"]},
    {"id":"10000000-0000-4000-8000-000000000022","slug":"jones","label":"Auntie Susan Jones & Uncle Craig Jones","greeting":"Auntie Susan and Uncle Craig","guests":["Auntie Susan Jones","Uncle Craig Jones"]},
    {"id":"10000000-0000-4000-8000-000000000023","slug":"david-hiu","label":"Jenn David & Matt Hiu","greeting":"Jenn and Matt","guests":["Jenn David","Matt Hiu"]},
    {"id":"10000000-0000-4000-8000-000000000024","slug":"nobleza","label":"Giselle Nobleza, James, Ethan, & Mason","greeting":"Giselle, James, Ethan, and Mason","guests":["Giselle Nobleza","James","Ethan","Mason"]},
    {"id":"10000000-0000-4000-8000-000000000026","slug":"phommasouk","label":"Frank Phommasouk, Nikkie Phommasouk, & Ayrton","greeting":"Frank, Nikkie, and Ayrton","guests":["Frank Phommasouk","Nikkie Phommasouk","Ayrton"]},
    {"id":"10000000-0000-4000-8000-000000000027","slug":"phanthavong","label":"Patrick Phanthavong, Mely Canul, & Avril","greeting":"Patrick, Mely, and Avril","guests":["Patrick Phanthavong","Mely Canul","Avril"]},
    {"id":"10000000-0000-4000-8000-000000000028","slug":"elliott-hernandez","label":"Cassie Elliott & Ana Hernandez","greeting":"Cassie and Ana","guests":["Cassie Elliott","Ana Hernandez"]},
    {"id":"10000000-0000-4000-8000-000000000029","slug":"hanks","label":"James Hanks & Ralph","greeting":"James and Ralph","guests":["James Hanks","Ralph"]},
    {"id":"10000000-0000-4000-8000-000000000030","slug":"stevens","label":"TR Stevens, Norma Stevens, & Mia","greeting":"TR, Norma, and Mia","guests":["TR Stevens","Norma Stevens","Mia"]},
    {"id":"10000000-0000-4000-8000-000000000031","slug":"martinez","label":"Julio Martinez & Diana Martinez","greeting":"Julio and Diana","guests":["Julio Martinez","Diana Martinez"]},
    {"id":"10000000-0000-4000-8000-000000000032","slug":"pietrobon","label":"Tiffany Pietrobon & Jacob","greeting":"Tiffany and Jacob","guests":["Tiffany Pietrobon","Jacob"]},
    {"id":"10000000-0000-4000-8000-000000000033","slug":"pun","label":"Sapana Pun","greeting":"Sapana","guests":["Sapana Pun"]},
    {"id":"10000000-0000-4000-8000-000000000034","slug":"proffitt-tan","label":"Jonathan Proffitt, Joyce Tan, & Jase","greeting":"Jonathan, Joyce, and Jase","guests":["Jonathan Proffitt","Joyce Tan","Jase"]},
    {"id":"10000000-0000-4000-8000-000000000035","slug":"ruiz-charbonneau","label":"Mike Ruiz & Gina Charbonneau","greeting":"Mike and Gina","guests":["Mike Ruiz","Gina Charbonneau"]},
    {"id":"10000000-0000-4000-8000-000000000036","slug":"fagundes","label":"Kevin Fagundes, Christina Fagundes, Ella, & Eli","greeting":"Kevin, Christina, Ella, and Eli","guests":["Kevin Fagundes","Christina Fagundes","Ella","Eli"]},
    {"id":"10000000-0000-4000-8000-000000000037","slug":"lee","label":"Aurora Lee, Carl Lee, & Majika","greeting":"Aurora, Carl, and Majika","guests":["Aurora Lee","Carl Lee","Majika"]},
    {"id":"10000000-0000-4000-8000-000000000038","slug":"pereira","label":"Donny Pereira","greeting":"Donny","guests":["Donny Pereira"]},
    {"id":"10000000-0000-4000-8000-000000000039","slug":"thore","label":"Zak Thore","greeting":"Zak","guests":["Zak Thore"]},
    {"id":"10000000-0000-4000-8000-000000000040","slug":"clark","label":"Ramona Clark","greeting":"Ramona","guests":["Ramona Clark"]},
    {"id":"10000000-0000-4000-8000-000000000041","slug":"aguilera","label":"Alicia Aguilera","greeting":"Alicia","guests":["Alicia Aguilera"]},
    {"id":"10000000-0000-4000-8000-000000000042","slug":"chavez","label":"Lily Chavez","greeting":"Lily","guests":["Lily Chavez"]},
    {"id":"10000000-0000-4000-8000-000000000043","slug":"fiore","label":"Erin Fiore","greeting":"Erin","guests":["Erin Fiore"]},
    {"id":"10000000-0000-4000-8000-000000000044","slug":"gong","label":"Betsy Gong","greeting":"Betsy","guests":["Betsy Gong"]},
    {"id":"10000000-0000-4000-8000-000000000045","slug":"hernandez","label":"Alma Hernandez","greeting":"Alma","guests":["Alma Hernandez"]},
    {"id":"10000000-0000-4000-8000-000000000046","slug":"kremesec","label":"Josie Kremesec","greeting":"Josie","guests":["Josie Kremesec"]},
    {"id":"10000000-0000-4000-8000-000000000047","slug":"rawlings","label":"Amanda Rawlings","greeting":"Amanda","guests":["Amanda Rawlings"]},
    {"id":"10000000-0000-4000-8000-000000000048","slug":"salcedo","label":"Cesar Salcedo","greeting":"Cesar","guests":["Cesar Salcedo"]},
    {"id":"10000000-0000-4000-8000-000000000049","slug":"spencer","label":"Linda Spencer","greeting":"Linda","guests":["Linda Spencer"]},
    {"id":"10000000-0000-4000-8000-000000000050","slug":"letasi","label":"Kristin Letasi","greeting":"Kristin","guests":["Kristin Letasi"]},
    {"id":"10000000-0000-4000-8000-000000000051","slug":"robinson","label":"Sean Robinson","greeting":"Sean","guests":["Sean Robinson"]},
    {"id":"10000000-0000-4000-8000-000000000052","slug":"silva","label":"Roz Silva","greeting":"Roz","guests":["Roz Silva"]},
    {"id":"10000000-0000-4000-8000-000000000053","slug":"thompson","label":"BJ Thompson, Amber Thompson, Theo, & Matthew","greeting":"BJ, Amber, Theo, and Matthew","guests":["BJ Thompson","Amber Thompson","Theo","Matthew"]},
    {"id":"10000000-0000-4000-8000-000000000054","slug":"wang","label":"Yili Wang, Destiny, & Trinity","greeting":"Yili, Destiny, and Trinity","guests":["Yili Wang","Destiny","Trinity"]},
    {"id":"10000000-0000-4000-8000-000000000055","slug":"wicker-wolfe","label":"David Wicker & Rachel Wolfe","greeting":"David and Rachel","guests":["David Wicker","Rachel Wolfe"]},
    {"id":"10000000-0000-4000-8000-000000000056","slug":"louie-rodriguez","label":"Victoria Louie & Sergio Rodriguez","greeting":"Victoria and Sergio","guests":["Victoria Louie","Sergio Rodriguez"]},
    {"id":"10000000-0000-4000-8000-000000000058","slug":"gamez-burner","label":"Frankie Gamez & Shaun Burner","greeting":"Frankie and Shaun","guests":["Frankie Gamez","Shaun Burner"]}
  ]$json$::jsonb) as entries(value)
  loop
    v_household_id := (item->>'id')::uuid;
    insert into public.households (id, slug, display_name, invitation_label, message_greeting)
    values (v_household_id, item->>'slug', item->>'label', item->>'label', item->>'greeting')
    on conflict (id) do update set slug = excluded.slug, display_name = excluded.display_name, invitation_label = excluded.invitation_label, message_greeting = excluded.message_greeting;

    if not exists (select 1 from public.guests g where g.household_id = v_household_id) then
      insert into public.guests (household_id, display_name, sort_order)
      select v_household_id, guest_name, (guest_order - 1)::integer
      from jsonb_array_elements_text(item->'guests') with ordinality as guest_rows(guest_name, guest_order);
    end if;
  end loop;
end;
$seed$;
