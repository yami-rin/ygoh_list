--神折神－ミハシラ
--Kamiori Deity - Mihashira (original card)
local s,id=GetID()
local SET_KAMIORI=0x7c5
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 1 "Kamiori" monster
	Link.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsSetCard,SET_KAMIORI),1,1)
	--① Link Summoned: place 1 "Kamiori" Continuous Spell/Trap from the Deck face-up on your field
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetCountLimit(1,{id,0})
	e1:SetCondition(function(e) return e:GetHandler():IsSummonType(SUMMON_TYPE_LINK) end)
	e1:SetTarget(s.pltg)
	e1:SetOperation(s.plop)
	c:RegisterEffect(e1)
	--② once per turn: send 1 card you control to the GY, move this card to an unused Main Monster Zone of yours,
	--   then return all of the opponent's cards in that column to the hand
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_TOHAND)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1)
	e2:SetCost(s.mvcost)
	e2:SetTarget(s.mvtg)
	e2:SetOperation(s.mvop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_KAMIORI}
function s.plfilter(c)
	return c:IsSetCard(SET_KAMIORI) and c:IsType(TYPE_CONTINUOUS) and c:IsSpellTrap() and not c:IsForbidden()
end
function s.pltg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_SZONE)>0
		and Duel.IsExistingMatchingCard(s.plfilter,tp,LOCATION_DECK,0,1,nil) end
end
function s.plop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.GetLocationCount(tp,LOCATION_SZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOFIELD)
	local tc=Duel.SelectMatchingCard(tp,s.plfilter,tp,LOCATION_DECK,0,1,1,nil):GetFirst()
	if tc then Duel.MoveToField(tc,tp,tp,LOCATION_SZONE,POS_FACEUP,true) end
end
--bit mask of your Main Monster Zones that are unused (a card that is about to leave as cost counts as unused)
function s.freezones(c,tp,ex)
	local flag=0
	for seq=0,4 do
		local tc=Duel.GetFieldCard(tp,LOCATION_MZONE,seq)
		if (tc==nil and Duel.CheckLocation(tp,LOCATION_MZONE,seq)) or (ex and tc==ex) then flag=flag|(1<<seq) end
	end
	return flag
end
--opponent's cards in the column of your Main Monster Zone seq (their Monster/Spell & Trap Zone 4-seq and the
--Extra Monster Zone above zone 1 or 3, which is the opponent's zone 6 or 5)
function s.oppcolumn(tp,seq)
	local g=Group.CreateGroup()
	local list={{LOCATION_MZONE,4-seq},{LOCATION_SZONE,4-seq}}
	if seq==1 then list[3]={LOCATION_MZONE,6} elseif seq==3 then list[3]={LOCATION_MZONE,5} end
	for _,z in ipairs(list) do
		local tc=Duel.GetFieldCard(1-tp,z[1],z[2])
		if tc then g:AddCard(tc) end
	end
	return g
end
--the move needs an unused zone; "then you can return" the column is optional
function s.cfilter(c,mc,tp)
	return c:IsAbleToGraveAsCost() and s.freezones(mc,tp,c)~=0
end
function s.mvcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	--the cost cannot be this card: it has to stay on the field to move
	if chk==0 then return Duel.IsExistingMatchingCard(s.cfilter,tp,LOCATION_ONFIELD,0,1,c,c,tp) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,s.cfilter,tp,LOCATION_ONFIELD,0,1,1,c,c,tp)
	Duel.SendtoGrave(g,REASON_COST)
end
function s.mvtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,0,1-tp,LOCATION_ONFIELD)
end
function s.mvop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not (c:IsRelateToEffect(e) and c:IsControler(tp) and c:IsLocation(LOCATION_MZONE)) then return end
	local flag=s.freezones(c,tp,nil)
	if flag==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOZONE)
	local zone=Duel.SelectDisableField(tp,1,LOCATION_MZONE,0,0xff~flag)
	local nseq=0
	while zone>1 do zone=zone>>1 nseq=nseq+1 end
	Duel.MoveSequence(c,nseq)
	if c:GetSequence()~=nseq then return end
	local g=c:GetColumnGroup():Filter(Card.IsControler,nil,1-tp)
	if #g>0 and Duel.SelectYesNo(tp,aux.Stringid(id,2)) then
		Duel.BreakEffect()
		Duel.SendtoHand(g,nil,REASON_EFFECT)
	end
end
