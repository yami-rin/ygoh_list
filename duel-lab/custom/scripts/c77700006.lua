--連鎖律－オーバークロック
--Chain Code - Overclock (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 2+ Effect Monsters
	Link.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsType,TYPE_EFFECT),2)
	--① when your opponent activates an effect: Set 1 "Chain Code" card from your hand/Deck
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_CHAINING)
	e1:SetRange(LOCATION_MZONE)
	e1:SetCountLimit(1,id)
	e1:SetCondition(function(e,tp,eg,ep,ev,re,r,rp) return rp==1-tp end)
	e1:SetTarget(s.settg)
	e1:SetOperation(s.setop)
	c:RegisterEffect(e1)
	--② an effect activated as Chain Link 3 or higher (once per chain): destroy up to (this Chain Link - 1) opponent cards
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_DESTROY)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_CHAINING)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCondition(s.descon)
	e2:SetTarget(s.destg)
	e2:SetOperation(s.desop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
--A "Chain Code" Spell/Trap is Set to the Spell & Trap Zone; a monster is Set face-down in the Monster Zone
--(Special Summoned in face-down Defense Position, as official "Set a monster" effects are scripted).
function s.stfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsSpellTrap() and c:IsSSetable()
end
function s.monfilter(c,e,tp)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsMonster() and c:IsCanBeSpecialSummoned(e,0,tp,false,false,POS_FACEDOWN_DEFENSE)
end
function s.canmon(e,tp)
	return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and Duel.IsExistingMatchingCard(s.monfilter,tp,LOCATION_HAND+LOCATION_DECK,0,1,nil,e,tp)
end
function s.canst(tp)
	return Duel.IsExistingMatchingCard(s.stfilter,tp,LOCATION_HAND+LOCATION_DECK,0,1,nil)
end
function s.settg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return s.canmon(e,tp) or s.canst(tp) end
end
function s.setop(e,tp,eg,ep,ev,re,r,rp)
	local mon,st=s.canmon(e,tp),s.canst(tp)
	if not mon and not st then return end
	--Choose the kind first so a monster is never buried in a long mixed list.
	local setmon=mon
	if mon and st then setmon=Duel.SelectOption(tp,aux.Stringid(id,2),aux.Stringid(id,3))==0 end
	if setmon then
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SET)
		local tc=Duel.SelectMatchingCard(tp,s.monfilter,tp,LOCATION_HAND+LOCATION_DECK,0,1,1,nil,e,tp):GetFirst()
		if tc and Duel.SpecialSummon(tc,0,tp,tp,false,false,POS_FACEDOWN_DEFENSE)>0 then Duel.ConfirmCards(1-tp,tc) end
	else
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SET)
		local tc=Duel.SelectMatchingCard(tp,s.stfilter,tp,LOCATION_HAND+LOCATION_DECK,0,1,1,nil):GetFirst()
		if tc then Duel.SSet(tp,tc) end
	end
end
function s.descon(e,tp,eg,ep,ev,re,r,rp)
	return Duel.GetCurrentChain(true)>=3 and Duel.GetFlagEffect(tp,id+100)==0
end
function s.destg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(nil,tp,0,LOCATION_ONFIELD,1,nil) end
	Duel.RegisterFlagEffect(tp,id+100,RESET_CHAIN,0,1)
	--this effect's Chain Link number minus 1
	e:SetLabel(Duel.GetCurrentChain()-1)
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,nil,1,1-tp,LOCATION_ONFIELD)
end
function s.desop(e,tp,eg,ep,ev,re,r,rp)
	local ct=e:GetLabel()
	if ct<1 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local g=Duel.SelectMatchingCard(tp,nil,tp,0,LOCATION_ONFIELD,1,ct,nil)
	if #g>0 then Duel.HintSelection(g) Duel.Destroy(g,REASON_EFFECT) end
end
