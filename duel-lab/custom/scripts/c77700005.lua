--連鎖律－コンパイラ
--Chain Code - Compiler (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 2 "Chain Code" monsters
	Link.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsSetCard,SET_CHAIN_CODE),2,2)
	--① when Link Summoned: Set 1 "Chain Code" Spell/Trap from the Deck
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetCountLimit(1,{id,0})
	e1:SetCondition(s.setcon)
	e1:SetCost(s.markchain)
	e1:SetTarget(s.settg)
	e1:SetOperation(s.setop)
	c:RegisterEffect(e1)
	--② when you activate an effect: Special Summon 1 "Chain Code" monster except this name from Deck/GY
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_CHAINING)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.owncon)
	e2:SetCost(s.markchain)
	e2:SetTarget(s.sptg)
	e2:SetOperation(s.spop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
--"cannot be activated in the same chain"
function s.samechain(e,tp)
	return Duel.GetFlagEffect(tp,id)==0
end
function s.markchain(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.RegisterFlagEffect(tp,id,RESET_CHAIN,0,1)
end
function s.setcon(e,tp,eg,ep,ev,re,r,rp)
	return e:GetHandler():IsLinkSummoned() and s.samechain(e,tp)
end
function s.owncon(e,tp,eg,ep,ev,re,r,rp)
	return rp==tp and s.samechain(e,tp)
end
function s.setfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsSpellTrap() and c:IsSSetable()
end
function s.settg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.setfilter,tp,LOCATION_DECK,0,1,nil) end
end
function s.setop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SET)
	local g=Duel.SelectMatchingCard(tp,s.setfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #g>0 then Duel.SSet(tp,g) end
end
function s.spfilter(c,e,tp)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsMonster() and not c:IsCode(id) and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_DECK+LOCATION_GRAVE,0,1,nil,e,tp) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_DECK+LOCATION_GRAVE)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.GetLocationCount(tp,LOCATION_MZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local g=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(s.spfilter),tp,LOCATION_DECK+LOCATION_GRAVE,0,1,1,nil,e,tp)
	if #g>0 then Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP) end
end
