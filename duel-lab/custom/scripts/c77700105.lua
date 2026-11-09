--凋落の暴君－タイラント
--Decline Tyrant (original card)
local s,id=GetID()
local SET_DECLINE=0x7c0
local CARD_IDOL=77700104
function s.initial_effect(c)
	--① Tribute Summoned: banish 1 card from opponent's field/GY (2 if they have a monster whose ATK is below its original ATK)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_REMOVE)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetCode(EVENT_SUMMON_SUCCESS)
	e1:SetCountLimit(1,id)
	e1:SetCondition(function(e) return e:GetHandler():IsSummonType(SUMMON_TYPE_TRIBUTE) end)
	e1:SetTarget(s.rmtg)
	e1:SetOperation(s.rmop)
	c:RegisterEffect(e1)
	--② once per turn (either turn): banish 2 "Decline" cards from the Deck, search a "Decline" monster, then Normal Summon 1 monster
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH+CATEGORY_SUMMON)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetHintTiming(0,TIMINGS_CHECK_MONSTER+TIMING_MAIN_END)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1)
	e2:SetCost(s.thcost)
	e2:SetTarget(s.thtg)
	e2:SetOperation(s.thop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_DECLINE}
function s.lowered(c)
	return c:IsFaceup() and c:GetAttack()<c:GetBaseAttack()
end
function s.rmtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(Card.IsAbleToRemove,tp,0,LOCATION_ONFIELD+LOCATION_GRAVE,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,nil,1,1-tp,LOCATION_ONFIELD+LOCATION_GRAVE)
end
function s.rmop(e,tp,eg,ep,ev,re,r,rp)
	local max=Duel.IsExistingMatchingCard(s.lowered,tp,0,LOCATION_MZONE,1,nil) and 2 or 1
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(Card.IsAbleToRemove),tp,0,LOCATION_ONFIELD+LOCATION_GRAVE,1,max,nil)
	if #g>0 then Duel.HintSelection(g) Duel.Remove(g,POS_FACEUP,REASON_EFFECT) end
end
function s.cfilter(c)
	return c:IsSetCard(SET_DECLINE) and c:IsAbleToRemoveAsCost()
end
function s.thfilter(c)
	return c:IsSetCard(SET_DECLINE) and c:IsMonster() and c:IsAbleToHand()
end
--a monster in the Deck that could be Normal Summoned once it is in the hand (Level 4 or lower, or the Tributes are there)
function s.decksum(c,tp)
	if not (c:IsSummonableCard() and Duel.IsPlayerCanSummon(tp,SUMMON_TYPE_NORMAL,c)) then return false end
	local lv=c:GetLevel()
	if lv<=4 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 end
	if Duel.CheckTribute(c,lv<=6 and 1 or 2) then return true end
	--"Decline Idol" can also be Tribute Summoned with 1 Tribute Summoned monster
	return c:IsCode(CARD_IDOL) and Duel.CheckTribute(c,1,1,Duel.GetMatchingGroup(s.idolmat,tp,LOCATION_MZONE,LOCATION_MZONE,nil,tp))
end
function s.idolmat(c,tp)
	return c:IsSummonType(SUMMON_TYPE_TRIBUTE) and (c:IsControler(tp) or c:IsFaceup())
end
--The cost and the search share the Deck: the 2 banished cards must leave a "Decline" monster to add,
--and "then you Normal Summon 1 monster" needs a monster in the hand that can be Normal Summoned, or the added one.
function s.thcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local hs=Duel.IsExistingMatchingCard(Card.IsSummonable,tp,LOCATION_HAND,0,1,nil,true,nil)
	local t=Duel.GetMatchingGroup(function(c) return s.thfilter(c) and (hs or s.decksum(c,tp)) end,tp,LOCATION_DECK,0,nil)
	local g=Duel.GetMatchingGroup(s.cfilter,tp,LOCATION_DECK,0,nil)
	local function ok2(c2,c1) return c2~=c1 and t:IsExists(function(x) return x~=c1 and x~=c2 end,1,nil) end
	local function ok1(c1) return g:IsExists(ok2,1,c1,c1) end
	if chk==0 then return g:IsExists(ok1,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local c1=g:FilterSelect(tp,ok1,1,1,nil):GetFirst()
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local c2=g:FilterSelect(tp,ok2,1,1,c1,c1):GetFirst()
	Duel.Remove(Group.FromCards(c1,c2),POS_FACEUP,REASON_COST)
end
function s.thtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.thfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
	Duel.SetOperationInfo(0,CATEGORY_SUMMON,nil,1,0,0)
end
function s.thop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local g=Duel.SelectMatchingCard(tp,s.thfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #g==0 or Duel.SendtoHand(g,nil,REASON_EFFECT)==0 then return end
	Duel.ConfirmCards(1-tp,g)
	Duel.ShuffleHand(tp)
	--then you Normal Summon 1 monster (if you can)
	local sg=Duel.GetMatchingGroup(Card.IsSummonable,tp,LOCATION_HAND,0,nil,true,nil)
	if #sg==0 then return end
	Duel.BreakEffect()
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SUMMON)
	local tc=sg:Select(tp,1,1,nil):GetFirst()
	Duel.Summon(tp,tc,true,nil)
end
